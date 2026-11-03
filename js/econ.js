// Clackworks economy: pure data + math, shared by the game and tools/sim.mjs
export const SAVE_VERSION = 3;
export const GROWTH = 1.15;

// Gadgets bolted onto the marble run. rate = sparkles/sec per unit.
export const PRODUCERS = [
  { id: 'funnel',  name: 'Feeder Funnel',   cost: 15,     rate: 0.4,    color: '#f2a03d', desc: 'Drops a marble now and then.' },
  { id: 'ramp',    name: 'Zigzag Ramp',     cost: 110,    rate: 2,      color: '#e8574b', desc: 'More track, more clack.' },
  { id: 'bell',    name: 'Ding Bell',       cost: 1200,   rate: 11,     color: '#f5c542', desc: 'Every ding adds shine.' },
  { id: 'paint',   name: 'Paint Splasher',  cost: 13000,  rate: 60,     color: '#4fa3e0', desc: 'Splat! Painted marbles sparkle more.' },
  { id: 'loop',    name: 'Loop-de-Loop',    cost: 140000, rate: 330,    color: '#8e6bd8', desc: 'Wheee! Round and round.' },
  { id: 'spring',  name: 'Boing Spring',    cost: 1.6e6,  rate: 1900,   color: '#4cc28a', desc: 'Bounces marbles sky-high.' },
  { id: 'kiln',    name: 'Rainbow Kiln',    cost: 2.2e7,  rate: 12000,  color: '#ef7fb0', desc: 'Bakes marbles into rainbows.' },
  { id: 'polish',  name: 'Star Polisher',   cost: 3.4e8,  rate: 78000,  color: '#ffd166', desc: 'Buffs marbles to a starry glow.' },
  { id: 'lift',    name: 'Moon Lift',       cost: 5.2e9,  rate: 5.1e5,  color: '#9ad1d4', desc: 'Carries marbles past the moon.' },
  { id: 'comet',   name: 'Comet Chute',     cost: 8e10,   rate: 3.4e6,  color: '#ff8c42', desc: 'A tail of glitter behind every roll.' },
  { id: 'galaxy',  name: 'Galaxy Gearbox',  cost: 1.3e12, rate: 2.4e7,  color: '#5b7bd5', desc: 'Gears made of tiny galaxies.' },
  { id: 'dream',   name: 'Dream Engine',    cost: 2.1e13, rate: 1.7e8,  color: '#c86bfa', desc: 'Runs on happy thoughts.' },
];

export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
export function milestoneMult(owned) {
  let m = 1; for (const t of MILESTONES) if (owned >= t) m *= 2; return m;
}
export function nextMilestone(owned) { for (const t of MILESTONES) if (owned < t) return t; return null; }

// One-time upgrades (bought with sparkles).
export const UPGRADES = [];
// Crank (tap) power
const crankCosts = [40, 400, 6000, 9e4, 1.5e6, 3e7, 6e8, 1.2e10, 2.5e11, 5e12];
crankCosts.forEach((c, i) => UPGRADES.push({ id: 'crank' + i, name: ['Comfy Crank', 'Bigger Crank', 'Super Crank', 'Mega Crank', 'Ultra Crank', 'Hyper Crank', 'Giga Crank', 'Cosmic Crank', 'Dream Crank', 'Final Crank'][i], cost: c, kind: 'tap', mult: 2, desc: 'Each tap is worth ×2.', req: s => s.runEarned >= c * 0.3 }));
// Taps also earn a slice of /sec
[[3000, 0.02], [4e5, 0.03], [8e7, 0.04], [2e10, 0.05], [5e12, 0.06]].forEach(([c, p], i) => UPGRADES.push({ id: 'sticky' + i, name: 'Sticky Fingers ' + 'I II III IV V'.split(' ')[i], cost: c, kind: 'tapPct', pct: p, desc: `Taps also give ${Math.round(p * 100)}% of your /sec.`, req: s => s.runEarned >= c * 0.3 }));
// Per-gadget polish upgrades: unlock at owned 1, 10, 30, 60
PRODUCERS.forEach((p, i) => {
  [[1, 10, 2], [10, 120, 2], [30, 6000, 3], [60, 9e5, 3], [120, 5e9, 4]].forEach(([own, cm, m], k) => {
    UPGRADES.push({ id: `${p.id}_u${k}`, name: `${['Shiny', 'Sturdy', 'Speedy', 'Legendary', 'Mythic'][k]} ${p.name}`, cost: p.cost * cm, kind: 'prod', prod: i, mult: m, desc: `${p.name} makes ×${m}.`, req: s => s.owned[i] >= own });
  });
});
// Mechanic unlocks (layered)
UPGRADES.push({ id: 'golden', name: 'Golden Marbles', cost: 250, kind: 'unlock', desc: 'Lucky golden marbles start rolling by. Tap them!', req: s => s.runEarned >= 80 });
UPGRADES.push({ id: 'windup', name: 'Wind-up Key', cost: 2500, kind: 'unlock', desc: 'The crank turns itself: 2 taps/sec.', req: s => s.runEarned >= 800 });
UPGRADES.push({ id: 'lever', name: 'Turbo Lever', cost: 20000, kind: 'unlock', desc: 'Tapping charges a lever. Pull it for ×3 for 15s!', req: s => s.runEarned >= 6000 });
UPGRADES.push({ id: 'windup2', name: 'Double Spring Key', cost: 5e5, kind: 'unlock', desc: 'Wind-up Key turns 2× faster.', req: s => s.up.windup });
UPGRADES.push({ id: 'magnet', name: 'Lucky Magnet', cost: 3e6, kind: 'unlock', desc: 'Golden marbles show up 30% more often.', req: s => s.up.golden && s.runEarned >= 1e6 });
UPGRADES.push({ id: 'combo2', name: 'Combo Drum', cost: 8e4, kind: 'unlock', desc: 'Combo goes up to ×8.', req: s => s.runEarned >= 2e4 });
UPGRADES.push({ id: 'windup3', name: 'Turbo Spring Key', cost: 5e8, kind: 'unlock', desc: 'Wind-up Key turns 2× faster again.', req: s => s.up.windup2 });
UPGRADES.push({ id: 'frenzy2', name: 'Fizzy Frenzy', cost: 4e7, kind: 'unlock', desc: 'Frenzy lasts 50% longer.', req: s => s.up.golden && s.runEarned >= 1e7 });
export const UPG_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// Permanent gear tree (bought with gears, kept forever).
export const TREE = [
  { id: 'head',   name: 'Head Start',     max: 3, cost: [1, 3, 8],   x: 0, y: 0, req: [],          desc: l => `Start each build with ${fmt(HEAD_BANK[l])} sparkles.` },
  { id: 'crank',  name: 'Iron Crank',     max: 3, cost: [1, 4, 12],  x: -1, y: 1, req: ['head'],   desc: l => `Taps ×${[1, 3, 9, 27][l]}.` },
  { id: 'gold',   name: 'Gold Rush',      max: 3, cost: [2, 5, 14],  x: 1, y: 1, req: ['head'],    desc: l => `Golden marbles ${[0, 35, 70, 110][l]}% more often.` },
  { id: 'nap',    name: 'Long Nap',       max: 2, cost: [2, 6],      x: 0, y: 1, req: ['head'],    desc: l => `Offline: ${[50, 75, 100][l]}% speed, up to ${[4, 8, 24][l]}h.` },
  { id: 'keep',   name: 'Keep the Key',   max: 1, cost: [3],         x: -1, y: 2, req: ['crank'],  desc: l => l ? 'Wind-up Key & Golden Marbles are free from the start.' : 'Keep Wind-up Key & Golden Marbles after rebuilding.' },
  { id: 'combo',  name: 'Echo Combo',     max: 2, cost: [3, 9],      x: 0, y: 2, req: ['nap'],     desc: l => `Combo builds ${[1, 2, 3][l]}× faster and lasts longer.` },
  { id: 'frenzy', name: 'Frenzy Fizz',    max: 3, cost: [3, 8, 20],  x: 1, y: 2, req: ['gold'],    desc: l => `Frenzy is ×${[7, 10, 13, 17][l]}.` },
  { id: 'cheap',  name: 'Bulk Bolts',     max: 4, cost: [4, 8, 16, 32], x: -1, y: 3, req: ['keep'], desc: l => `Gadgets cost ${l * 5}% less.` },
  { id: 'chain',  name: 'Lucky Chain',    max: 1, cost: [10],        x: 1, y: 3, req: ['frenzy'],  desc: l => 'Golden marbles have a 25% chance to bring a friend.' },
  { id: 'mom',    name: 'Momentum',       max: 99, cost: null,       x: 0, y: 3, req: ['combo'],   desc: l => `All sparkles +${l * 25}%.` },
];
export const TREE_BY_ID = Object.fromEntries(TREE.map(n => [n.id, n]));
export function treeCost(node, lvl) { return node.cost ? node.cost[lvl] : Math.ceil(5 * Math.pow(1.5, lvl)); }

export const GEAR_BONUS = 0.10; // each gear ever earned: +10% all sparkles
export const GEAR_K = 7e9;
export function gearsFor(lifetime) { return Math.floor(Math.pow(lifetime / GEAR_K, 0.45) + 1e-9); }
export const MIN_PRESTIGE_GAIN = 5;

export function treeLvl(s, id) { return (s.tree && s.tree[id]) || 0; }

export function costMult(s) { return 1 - 0.05 * treeLvl(s, 'cheap'); }
export function producerCost(s, i, n = 1) {
  const p = PRODUCERS[i], o = s.owned[i];
  const base = p.cost * Math.pow(GROWTH, o) * costMult(s);
  return n === 1 ? base : base * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1);
}
export function maxAffordable(s, i) {
  const base = producerCost(s, i, 1);
  if (s.bank < base) return 0;
  return Math.floor(Math.log(s.bank * (GROWTH - 1) / base + 1) / Math.log(GROWTH));
}

export function prodMult(s, i) {
  let m = milestoneMult(s.owned[i]);
  for (let k = 0; k < 5; k++) if (s.up[`${PRODUCERS[i].id}_u${k}`]) m *= UPG_BY_ID[`${PRODUCERS[i].id}_u${k}`].mult;
  return m;
}
export function globalMult(s) {
  const gears = 1 + GEAR_BONUS * (s.gearsTotal || 0);
  const ach = 1 + 0.02 * (s.achCount || 0);
  const mom = 1 + 0.25 * treeLvl(s, 'mom');
  return gears * ach * mom;
}
export const HUM = 0.5; // the machine always trickles a little
export function baseCps(s) {
  let t = HUM;
  for (let i = 0; i < PRODUCERS.length; i++) if (s.owned[i]) t += s.owned[i] * PRODUCERS[i].rate * prodMult(s, i);
  return t * globalMult(s);
}
export function tapMult(s) {
  let m = 1;
  for (const u of UPGRADES) if (u.kind === 'tap' && s.up[u.id]) m *= u.mult;
  return m * [1, 3, 9, 27][treeLvl(s, 'crank')];
}
export function tapPct(s) { let p = 0; for (const u of UPGRADES) if (u.kind === 'tapPct' && s.up[u.id]) p += u.pct; return p; }
// value of one tap, before combo/boosts
export function tapValue(s, cps) { return (1 * tapMult(s)) * globalMult(s) + tapPct(s) * cps; }
export function comboMax(s) { return s.up.combo2 ? 8 : 5; }
export function windupRate(s) { if (!s.up.windup && treeLvl(s, 'keep') < 1) return 0; return 2 * (s.up.windup2 ? 2 : 1) * (s.up.windup3 ? 2 : 1); }
export function goldenUnlocked(s) { return !!s.up.golden || treeLvl(s, 'keep') >= 1; }
export function goldenInterval(s) { // mean seconds between golden marbles
  let f = 1 + [0, 0.35, 0.7, 1.1][treeLvl(s, 'gold')] + (s.up.magnet ? 0.3 : 0);
  return 55 / f;
}
export function frenzyMult(s) { return [7, 10, 13, 17][treeLvl(s, 'frenzy')]; }
export function frenzyDur(s) { return 20 * (s.up.frenzy2 ? 1.5 : 1); }
export function offlineRate(s) { return [0.5, 0.75, 1][treeLvl(s, 'nap')]; }
export function offlineCapH(s) { return [4, 8, 24][treeLvl(s, 'nap')]; }
export const HEAD_BANK = [0, 5e3, 5e5, 5e7];
export function startBank(s) { return HEAD_BANK[treeLvl(s, 'head')]; }

export function freshRun(s) {
  s.bank = startBank(s); s.runEarned = 0; s.owned = PRODUCERS.map(() => 0); s.up = {};
  if (treeLvl(s, 'keep') >= 1) { s.up.windup = true; s.up.golden = true; }
  return s;
}
export function newState() {
  const s = { v: SAVE_VERSION, bank: 0, runEarned: 0, lifetime: 0, owned: [], up: {}, gears: 0, gearsTotal: 0, tree: {}, ach: {}, achCount: 0,
    stats: { taps: 0, golden: 0, prestiges: 0, bestCombo: 1, playTime: 0, frenzies: 0, levers: 0 }, lastSeen: Date.now(), muted: false, created: Date.now() };
  return freshRun(s);
}
export function prestigeGain(s) { return Math.max(0, gearsFor(s.lifetime) - (s.gearsTotal || 0)); }

export function earn(s, x) { s.bank += x; s.runEarned += x; s.lifetime += x; }

// ---- number formatting: K M B T then aa ab ac ...
const SUFFIX = ['', 'K', 'M', 'B', 'T'];
export function fmt(n, dec) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n, dec);
  if (n < 1000) return n < 10 && dec ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toString();
  const e = Math.floor(Math.log10(n) / 3);
  let suf;
  if (e < SUFFIX.length) suf = SUFFIX[e];
  else { const k = e - SUFFIX.length; suf = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
  const v = n / Math.pow(1000, e);
  let str = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  if (str.includes('.')) str = str.replace(/\.?0+$/, '');
  return str + suf;
}
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
  return Math.floor(sec / 3600) + 'h ' + Math.floor(sec % 3600 / 60) + 'm';
}

// ---- achievements: each gives +2% all sparkles forever
export const ACHIEVEMENTS = [];
const A = (id, name, desc, test) => ACHIEVEMENTS.push({ id, name, desc, test });
[[100, 'First Handful'], [1e4, 'Pocket Full'], [1e6, 'Marble Millionaire'], [1e9, 'Billion Shine'], [1e12, 'Trillion Twinkle'], [1e15, 'Sparkle Sea'], [1e18, 'Shine Galaxy']].forEach(([n, nm], i) => A('earn' + i, nm, `Earn ${fmt(n)} sparkles in total.`, s => s.lifetime >= n));
[[1, 'Clack!'], [10, 'Busy Machine'], [50, 'Clack Factory'], [150, 'Clackopolis'], [400, 'Clackiverse']].forEach(([n, nm], i) => A('own' + i, nm, `Own ${n} gadgets.`, s => s.owned.reduce((a, b) => a + b, 0) >= n));
PRODUCERS.forEach((p, i) => A('p' + i, p.name + ' Fan', `Own 25 ${p.name}s.`, s => s.owned[i] >= 25));
[[100, 'Tap Tap'], [1000, 'Speedy Fingers'], [10000, 'Crank Champion']].forEach(([n, nm], i) => A('tap' + i, nm, `Tap ${fmt(n)} times.`, s => s.stats.taps >= n));
[[1, 'Ooh, Shiny'], [10, 'Gold Collector'], [50, 'Goldfinger']].forEach(([n, nm], i) => A('gold' + i, nm, `Catch ${n} golden marble${n > 1 ? 's' : ''}.`, s => s.stats.golden >= n));
[[5, 'Combo ×5'], [8, 'Combo Master']].forEach(([n, nm], i) => A('combo' + i, nm, `Reach a ×${n} combo.`, s => s.stats.bestCombo >= n));
[[1, 'Lever Puller'], [25, 'Lever Legend']].forEach(([n, nm], i) => A('lever' + i, nm, `Pull the Turbo Lever ${n} time${n > 1 ? 's' : ''}.`, s => s.stats.levers >= n));
[[1, 'Fresh Build'], [3, 'Master Builder'], [10, 'Machine Whisperer']].forEach(([n, nm], i) => A('pres' + i, nm, `Rebuild the machine ${n} time${n > 1 ? 's' : ''}.`, s => s.stats.prestiges >= n));
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// save migration
export function migrate(raw) {
  const s = newState();
  if (!raw || typeof raw !== 'object') return s;
  let d = raw;
  if (!d.v || d.v < 2) { // v1: {money, items, total}
    d = { ...d, bank: d.money ?? d.bank ?? 0, owned: d.items ?? d.owned ?? [], lifetime: d.total ?? d.lifetime ?? 0, v: 2 };
  }
  if (d.v < 3) { d.stats = { ...(d.stats || {}), levers: 0 }; d.v = 3; }
  for (const k of Object.keys(s)) if (d[k] !== undefined) s[k] = (typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k]) ? { ...s[k], ...d[k] } : d[k];
  s.owned = PRODUCERS.map((_, i) => Math.max(0, Math.floor(+s.owned[i] || 0)));
  for (const k of ['bank', 'runEarned', 'lifetime', 'gears', 'gearsTotal']) s[k] = isFinite(+s[k]) ? +s[k] : 0;
  s.achCount = Object.keys(s.ach).filter(k => ACH_BY_ID[k]).length;
  s.v = SAVE_VERSION;
  return s;
}
export function lifetimeForGears(n) { return GEAR_K * Math.pow(n, 1 / 0.45); }
export function upgCost(s, u) { return u.cost * costMult(s); }
export function producerVisible(s, i) { return i === 0 || s.owned[i - 1] > 0 || s.owned[i] > 0 || s.runEarned >= PRODUCERS[i].cost * 0.6; }
