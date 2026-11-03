// Economy simulator: node tools/sim.mjs [tapsPerSec] [runs]
import * as E from '../js/econ.js';
const TAPS = +(process.argv[2] ?? 3), RUNS = +(process.argv[3] ?? 4), VERBOSE = process.argv.includes('-v');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const s = E.newState();
let lever = 0, leverT = 0, frenzyT = 0, stormT = 0, goldenCd = 30, combo = 1;
function tapIncome(cps) {
  const auto = E.windupRate(s);
  const tv = E.tapValue(s, cps) * (stormT > 0 ? 25 : 1);
  const comboAvg = TAPS > 0 ? 1 + (E.comboMax(s) - 1) * 0.6 : 1;
  return TAPS * tv * comboAvg + auto * tv;
}
function income() { // per sec
  let cps = E.baseCps(s);
  const boost = (frenzyT > 0 ? E.frenzyMult(s) : 1) * (leverT > 0 ? 3 : 1);
  return cps * boost + tapIncome(cps * boost);
}
function steadyIncome() { return E.baseCps(s) + tapIncome(E.baseCps(s)); }
function candidates() {
  const c = [];
  E.PRODUCERS.forEach((p, i) => {
    const cost = E.producerCost(s, i);
    if (i === 0 || s.owned[i - 1] > 0 || s.runEarned >= cost * 0.6) c.push({ kind: 'p', i, cost, name: p.name });
  });
  for (const u of E.UPGRADES) if (!s.up[u.id] && u.req(s)) c.push({ kind: 'u', u, cost: u.cost * E.costMult(s), name: u.name });
  return c;
}
function delta(cd) {
  const before = steadyIncome();
  if (cd.kind === 'p') { s.owned[cd.i]++; const a = steadyIncome(); s.owned[cd.i]--; return a - before; }
  const u = cd.u;
  if (u.kind === 'unlock') {
    const h = { golden: 0.8, windup: 0.3, lever: 0.25, windup2: 0.2, magnet: 0.2, combo2: 0.2, windup3: 0.15, frenzy2: 0.2 }[u.id];
    s.up[u.id] = true; const a = steadyIncome(); delete s.up[u.id];
    return Math.max(a - before, h * before);
  }
  s.up[u.id] = true; const a = steadyIncome(); delete s.up[u.id]; return a - before;
}
function buy(cd, t, log) {
  s.bank -= cd.cost;
  if (cd.kind === 'p') s.owned[cd.i]++; else s.up[cd.u.id] = true;
  log.push({ t, name: cd.name });
}
function checkAch() { for (const a of E.ACHIEVEMENTS) if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = 1; s.achCount++; } }
function spendTree() {
  const order = ['head', 'crank', 'gold', 'nap', 'keep', 'frenzy', 'combo', 'cheap', 'mom', 'chain'];
  let bought = true;
  while (bought) {
    bought = false;
    for (const id of order) {
      const n = E.TREE_BY_ID[id], l = E.treeLvl(s, id);
      if (l >= n.max) continue;
      if (!n.req.every(r => E.treeLvl(s, r) > 0)) continue;
      const c = E.treeCost(n, l);
      if (s.gears >= c) { s.gears -= c; s.tree[id] = l + 1; bought = true; break; }
    }
  }
}
const report = [];
for (let run = 1; run <= RUNS; run++) {
  const log = []; let t = 0, lastBuy = 0, maxGap = 0, maxGapAt = 0; const gaps = []; const marks = [];
  const runLimit = 3 * 3600;
  while (t < runLimit) {
    t++;
    // events
    if (E.goldenUnlocked(s) && --goldenCd <= 0) {
      goldenCd = E.goldenInterval(s) * (0.6 + 0.8 * rnd());
      const r = rnd(); const cps = E.baseCps(s);
      if (r < 0.5) frenzyT = E.frenzyDur(s);
      else if (r < 0.85) E.earn(s, Math.max(60 * steadyIncome(), Math.min(0.15 * s.bank, 900 * cps)) + 20);
      else stormT = 12;
    }
    if (s.up.lever) { lever += TAPS + 0.5; if (lever >= 150) { lever = 0; leverT = 15; } }
    E.earn(s, income());
    frenzyT--; stormT--; leverT--;
    checkAch();
    // buy loop
    for (let k = 0; k < 50; k++) {
      const c = candidates(); if (!c.length) break;
      let best = null, bs = Infinity;
      for (const cd of c) { const d = delta(cd); const sc = cd.cost / Math.max(d, 1e-9); if (sc < bs) { bs = sc; best = cd; } }
      let pick = best.cost <= s.bank ? best : null;
      if (!pick) { // cheap side-purchase
        const cheap = c.filter(cd => cd.cost <= s.bank && cd.cost < best.cost * 0.1).sort((a, b) => a.cost - b.cost)[0];
        pick = cheap || null;
      }
      if (!pick) break;
      buy(pick, t, log);
      const g = t - lastBuy; if (g > maxGap) { maxGap = g; maxGapAt = t; } gaps.push(g); lastBuy = t;
    }
    if (t % (+process.env.MARK || 300) === 0) marks.push(`${(t / 60).toFixed(0)}m: life ${E.fmt(s.lifetime)} maxgapsofar ${maxGap} cps ${E.fmt(E.baseCps(s))} tap ${E.fmt(E.tapValue(s, E.baseCps(s)))} bank ${E.fmt(s.bank)} gain ${E.prestigeGain(s)} owned ${s.owned.join(',')}`);
    const gain = E.prestigeGain(s);
    const want = run === 1 ? E.MIN_PRESTIGE_GAIN : Math.max(E.MIN_PRESTIGE_GAIN, Math.ceil(s.gearsTotal * 1.0));
    if (!process.env.NOPRES && gain >= want && t > 60) break;
  }
  const gain = E.prestigeGain(s);
  const sorted = gaps.slice().sort((a, b) => a - b);
  const early = log.filter(l => l.t <= 120).length;
  report.push({ run, minutes: +(t / 60).toFixed(1), gain, buys: log.length, buysFirst2min: early, maxGapSec: maxGap, maxGapAtMin: +(maxGapAt / 60).toFixed(1), p90gap: sorted[Math.floor(sorted.length * 0.9)], tail: t - lastBuy, gearsBefore: s.gearsTotal });
  if (VERBOSE) { console.log(`--- run ${run}`); marks.forEach(m => console.log(m)); console.log('first buys:', log.slice(0, 15).map(l => l.t + 's ' + l.name).join(' | ')); }
  // prestige
  s.gears += gain; s.gearsTotal += gain; s.stats.prestiges++;
  spendTree();
  E.freshRun(s); lever = 0; frenzyT = stormT = leverT = 0; goldenCd = 30;
  if (VERBOSE) console.log('tree', JSON.stringify(s.tree), 'gears left', s.gears);
}
console.table(report);
