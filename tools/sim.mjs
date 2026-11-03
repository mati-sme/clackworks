// Economy simulator for Clackworks v2 (automated core).
// node tools/sim.mjs [profile] [runs] [-v]    profile: idle | active | tappy | all (default all)
//   idle   = never taps anything, just buys the best thing it can afford (the auto-builder does the same)
//   active = also catches ~80% of golden marbles and pulls the Turbo lever when it is full
//   tappy  = active + pops ~2 marbles/sec by tapping them
import * as E from '../js/econ.js';
const PROFILES = { idle: { gold: 0, lever: false, pops: 0 }, goldonly: { gold: 0.8, lever: false, pops: 0 }, leveronly: { gold: 0, lever: true, pops: 0 }, active: { gold: 0.8, lever: true, pops: 0 }, tappy: { gold: 0.8, lever: true, pops: 2 } };
const arg = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'all';
const RUNS = +(process.argv[3] ?? 4), VERBOSE = process.argv.includes('-v');

function simulate(name, P) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = E.newState();
  let lever = 0, leverT = 0, frenzyT = 0, goldenCd = 20;
  const boost = () => (frenzyT > 0 ? E.frenzyMult(s) : 1) * (leverT > 0 ? 3 : 1);
  const steady = () => { const c = E.baseCps(s); return E.incomeRate(s, c) + P.pops * E.popSecs(s) * c; };
  const income = () => { const c = E.baseCps(s) * boost(); return E.incomeRate(s, c) + P.pops * E.popSecs(s) * c; };
  function candidates() {
    const c = [];
    E.PRODUCERS.forEach((p, i) => { if (E.producerVisible(s, i)) c.push({ kind: 'p', i, cost: E.producerCost(s, i), name: p.name }); });
    for (const u of E.UPGRADES) if (!s.up[u.id] && u.req(s)) c.push({ kind: 'u', u, cost: E.upgCost(s, u), name: u.name });
    return c;
  }
  function delta(cd) {
    const before = steady();
    if (cd.kind === 'p') { s.owned[cd.i]++; const a = steady(); s.owned[cd.i]--; return a - before; }
    const u = cd.u; s.up[u.id] = true; const a = steady(); delete s.up[u.id];
    const h = { golden: P.gold ? 0.6 : 0.01, lever: P.lever ? 0.4 : 0.01, auto: 0.3, auto2: 0.1, magnet: P.gold ? 0.15 : 0.01, frenzy2: P.gold ? 0.15 : 0.01, popper: P.pops ? 0 : 0.01 }[u.id] || 0;
    return Math.max(a - before, h * before);
  }
  const report = [];
  for (let run = 1; run <= RUNS; run++) {
    const log = []; let t = 0, lastBuy = 0, maxGap = 0, maxGapAt = 0; const gaps = [];
    while (t < 3 * 3600) {
      t++;
      if (E.goldenUnlocked(s) && P.gold && --goldenCd <= 0) {
        goldenCd = E.goldenInterval(s) * (0.6 + 0.8 * rnd());
        if (rnd() < P.gold) {
          const r = rnd(), cps = E.baseCps(s);
          if (r < 0.5) frenzyT = E.frenzyDur(s);
          else if (r < 0.85) E.earn(s, E.showerGain(s, cps, steady()));
          else E.earn(s, 25 * cps);
        }
      }
      if (E.leverUnlocked(s) && P.lever && leverT <= 0) { lever += E.leverRate(s); if (lever >= E.LEVER_FULL) { lever = 0; leverT = 15; } }
      E.earn(s, income());
      frenzyT--; leverT--;
      for (const a of E.ACHIEVEMENTS) if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = 1; s.achCount++; }
      for (let k = 0; k < 60; k++) {
        const c = candidates(); if (!c.length) break;
        let best = null, bs = Infinity;
        for (const cd of c) { const sc = cd.cost / Math.max(delta(cd), 1e-9); if (sc < bs) { bs = sc; best = cd; } }
        let pick = best.cost <= s.bank ? best : c.filter(cd => cd.cost <= s.bank && cd.cost < best.cost * 0.1).sort((a, b) => a.cost - b.cost)[0];
        if (!pick) break;
        s.bank -= pick.cost; if (pick.kind === 'p') s.owned[pick.i]++; else s.up[pick.u.id] = true; s.stats.buys++;
        log.push({ t, name: pick.name });
        const g = t - lastBuy; if (g > maxGap) { maxGap = g; maxGapAt = t; } gaps.push(g); lastBuy = t;
      }
      const want = run === 1 ? E.MIN_PRESTIGE_GAIN : Math.max(E.MIN_PRESTIGE_GAIN, s.gearsTotal);
      if (E.prestigeGain(s) >= want && t > 60) break;
    }
    const gain = E.prestigeGain(s), sorted = gaps.slice().sort((a, b) => a - b);
    report.push({ profile: name, run, minutes: +(t / 60).toFixed(1), gearsGained: gain, gearsBefore: s.gearsTotal, buys: log.length, buys1stMin: log.filter(l => l.t <= 60).length,
      maxGapSec: maxGap, maxGapAtMin: +(maxGapAt / 60).toFixed(1), p90gapSec: sorted[Math.floor(sorted.length * 0.9)] });
    if (VERBOSE) console.log(name, run, 'first buys:', log.slice(0, 14).map(l => l.t + 's ' + l.name).join(' | '));
    s.gears += gain; s.gearsTotal += gain; s.stats.prestiges++;
    for (let again = true; again;) { again = false; for (const id of ['head', 'oil', 'nap', 'keep', 'gold', 'quick', 'frenzy', 'cheap', 'mom', 'chain']) {
      const n = E.TREE_BY_ID[id], l = E.treeLvl(s, id); if (l >= n.max || !n.req.every(r => E.treeLvl(s, r) > 0)) continue;
      const c = E.treeCost(n, l); if (s.gears >= c) { s.gears -= c; s.tree[id] = l + 1; again = true; break; } } }
    E.freshRun(s); lever = 0; frenzyT = leverT = 0; goldenCd = 20;
  }
  return report;
}
const rows = [];
for (const [n, p] of Object.entries(PROFILES)) if (arg === 'all' || arg === n) rows.push(...simulate(n, p));
console.table(rows);
const first = rows.filter(r => r.run === 1);
const ok = rows.every(r => r.maxGapSec <= 75) && first.every(r => r.minutes >= 12 && r.minutes <= 28);
console.log(ok ? 'PASS: no dead zones (max gap ≤ 75s), first rebuild 12–28 min in every profile' : 'CHECK: a profile is outside the targets');
