import * as E from './econ.js';
import { Stage, drawGadget } from './render.js';
import { sfx, unlockAudio, setMuted } from './audio.js';

const KEY = 'clackworks.save';
const $ = id => document.getElementById(id);
const app = $('app');

// ---------- save / load ----------
function load() {
  try { const raw = localStorage.getItem(KEY) || localStorage.getItem(KEY + '.bak'); return E.migrate(raw ? JSON.parse(raw) : null); }
  catch (e) { console.warn('save unreadable, starting fresh'); return E.newState(); }
}
function save() {
  try { S.lastSeen = Date.now(); const j = JSON.stringify(S); localStorage.setItem(KEY, j); localStorage.setItem(KEY + '.bak', j); } catch (e) { /* storage full or blocked */ }
}
let S = load();
if (S.autoOn === undefined) S.autoOn = true;
setMuted(S.muted);

const stage = new Stage($('cv'), E.PRODUCERS);
stage.jarCap = E.JAR_CAP;
stage.setOwned(S.owned);
new ResizeObserver(() => stage.resize()).observe($('stage'));

const R = { lever: E.LEVER_FULL * 0.5, frenzyT: 0, turboT: 0, rainT: 0, goldenCd: 20, tab: 'gadgets', buyN: 1, disp: S.bank,
  spawnAcc: 0, pendingVis: 0, popBudget: 0, achT: 0, hintGold: false, uiT: 0, autoT: 0, best: null, bestT: 0,
  streak: 0, lastBuy: 0, newAch: 0, slots: [], panel: null, buzzT: 0, startT: performance.now() };

// ---------- helpers ----------
const fmt = E.fmt;
function buzz(p) { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; const now = performance.now(); if (typeof p === 'number' && now - R.buzzT < 60) return; R.buzzT = now; try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }
function boostMult() { return (R.frenzyT > 0 ? E.frenzyMult(S) : 1) * (R.turboT > 0 ? 3 : 1); }
function cpsNow() { return E.baseCps(S) * boostMult(); }
function incomeEstimate() { return E.incomeRate(S, cpsNow()); }
function steadyIncome() { return E.incomeRate(S, E.baseCps(S)); }
function pop(x, y, text, cls = 'sm') {
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  el.style.left = x + (Math.random() * 24 - 12) + 'px'; el.style.top = y + 'px'; $('pops').appendChild(el);
  setTimeout(() => el.remove(), 950);
  const all = $('pops').children; if (all.length > 30) all[0].remove();
}
function banner(title, sub = '') {
  const b = $('banner'); b.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function bigShake() { app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); }
function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
const toastQ = [];
function toast(title, sub) { toastQ.push([title, sub]); if (toastQ.length === 1) nextToast(); }
function nextToast() {
  if (!toastQ.length) return;
  let [title, sub] = toastQ[0];
  if (toastQ.length > 2) { title = `${toastQ.length} new trophies!`; sub = `+${toastQ.length * 2}% sparkles forever`; toastQ.length = 1; }
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<div class="medal"></div><div><b>${title}</b><span>${sub}</span></div>`;
  $('toasts').appendChild(el); setTimeout(() => { el.remove(); toastQ.shift(); nextToast(); }, 2600);
}
function jarScreen() { const j = stage.jarBox; return stage.toScreen(j.x + j.w / 2, j.y + 10); }
function elCenter(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + 6]; }

// ---------- best buy (shared by the BEST badge, the goal bar and the Auto-Builder) ----------
const UNLOCK_VALUE = { golden: 0.5, lever: 0.35, auto: 0.3, auto2: 0.1, magnet: 0.12, frenzy2: 0.12, popper: 0.05 };
function availableUpgrades() { return E.UPGRADES.filter(u => !S.up[u.id] && u.req(S)).sort((a, b) => a.cost - b.cost); }
function computeBest() {
  const base = steadyIncome(), inc = incomeEstimate(), reach = S.bank + 90 * inc;
  let best = null, bs = Infinity, cheapest = null;
  const consider = (c) => {
    if (!cheapest || c.cost < cheapest.cost) cheapest = c;
    if (c.cost > reach) return;
    const sc = c.cost / Math.max(c.gain, 1e-9); if (sc < bs) { bs = sc; best = c; }
  };
  E.PRODUCERS.forEach((p, i) => {
    if (!E.producerVisible(S, i)) return;
    S.owned[i]++; const g = steadyIncome() - base; S.owned[i]--;
    consider({ type: 'p', i, cost: E.producerCost(S, i), gain: g, name: p.name, tab: 'gadgets', key: 'p' + i });
  });
  for (const u of availableUpgrades()) {
    S.up[u.id] = true; let g = steadyIncome() - base; delete S.up[u.id];
    g = Math.max(g, (UNLOCK_VALUE[u.id] || 0) * base);
    consider({ type: 'u', id: u.id, cost: E.upgCost(S, u), gain: g, name: u.name, tab: 'upgrades', key: 'u' + u.id });
  }
  R.best = best || cheapest;
  return R.best;
}

// ---------- buying ----------
function buyCount(i) { return R.buyN === 'max' ? Math.max(1, E.maxAffordable(S, i)) : R.buyN; }
function buyFx(el, txt, cls = 'mid') {
  const now = performance.now(); R.streak = now - R.lastBuy < 450 ? R.streak + 1 : 0; R.lastBuy = now;
  sfx('buy', R.streak); buzz(10); S.stats.buys = (S.stats.buys || 0) + 1;
  if (el) { const [x, y] = elCenter(el); pop(x, y, txt, cls); el.animate([{ transform: 'translateY(3px) scale(.93)' }, { transform: 'translateY(-2px) scale(1.04)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }); }
}
function buyProducer(i, el, n = buyCount(i)) {
  const cost = E.producerCost(S, i, n);
  if (S.bank < cost) return false;
  const before = S.owned[i]; S.bank -= cost; S.owned[i] += n;
  const p = E.PRODUCERS[i]; buyFx(el, '+' + n);
  stage.setOwned(S.owned);
  const an = stage.anchor[p.id];
  if (an) { stage.burst(an[0], an[1], 'confetti', before === 0 ? 30 : 6); const s0 = Math.min(stage.len - 5, stage.sAt(an[0], an[1])); for (let k = 0; k < Math.min(n, 3); k++) stage.spawn({ s: s0, v: 160 + k * 40, quiet: true }); }
  if (before === 0) { banner('NEW GADGET!', p.name); sfx('milestone'); stage.shake(5); }
  for (const t of E.MILESTONES) if (before < t && S.owned[i] >= t) {
    setTimeout(() => { banner(`${p.name.split(' ').pop()} ×2!`, `${t} owned — milestone!`); sfx('milestone'); bigShake(); stage.burst(stage.W / 2, stage.H * .4, 'confetti', 50); buzz([20, 30, 20]); }, before === 0 ? 900 : 0);
    break;
  }
  afterBuy(); return true;
}
function buyUpgrade(u, el) {
  const cost = E.upgCost(S, u); if (S.bank < cost || S.up[u.id]) return false;
  S.bank -= cost; S.up[u.id] = true; buyFx(el, u.short || '✓', 'mid gold');
  if (u.kind === 'prod') { const an = stage.anchor[E.PRODUCERS[u.prod].id]; if (an) stage.burst(an[0], an[1], 'spark', 22, '#f5c542'); }
  else if (u.kind === 'global') { stage.burst(stage.W / 2, stage.H / 2, 'spark', 40, '#3fb6a8'); stage.shake(3); }
  else {
    banner('UNLOCKED!', u.name); sfx('unlock'); stage.burst(stage.W / 2, stage.H / 2, 'confetti', 40); bigShake();
    if (u.id === 'golden') R.goldenCd = 3;
    if (u.id === 'lever') R.lever = E.LEVER_FULL * 0.7;
    if (u.id === 'auto') { S.autoOn = true; setTimeout(() => toast('Auto-Builder online!', 'It buys the BEST buy for you. Tap AUTO to pause it.'), 900); }
  }
  afterBuy(); return true;
}
function buyItem(item, el, auto = false) {
  if (!item) return false;
  if (item.type === 'p') return buyProducer(item.i, el, auto ? 1 : undefined);
  if (item.type === 'u') return buyUpgrade(E.UPG_BY_ID[item.id], el);
  return false;
}
function afterBuy() { computeBest(); R.dirty = true; }

// ---------- golden marbles ----------
function catchGolden(m) {
  stage.catchGolden(m); S.stats.golden++; sfx('gold'); buzz([30, 40, 70]); flash(); bigShake();
  const r = Math.random();
  if (r < 0.5) { R.frenzyT = E.frenzyDur(S); S.stats.frenzies++; banner('FRENZY!', `×${E.frenzyMult(S)} sparkles for ${Math.round(E.frenzyDur(S))}s`); }
  else if (r < 0.85) {
    const gain = E.showerGain(S, E.baseCps(S), incomeEstimate());
    E.earn(S, gain); banner('MARBLE SHOWER!', '+' + fmt(gain) + ' sparkles'); const [x, y] = stage.toScreen(m.x, m.y); pop(x, y, '+' + fmt(gain), 'big gold');
    for (let i = 0; i < 12; i++) setTimeout(() => stage.spawn({ quiet: true, v: 200 }), i * 90);
  } else {
    R.rainT = 4; banner('GOLDEN RAIN!', 'Pop the little gold marbles!');
    for (let i = 0; i < 25; i++) setTimeout(() => stage.spawn({ mini: true, v: 150 + Math.random() * 120 }), i * 120);
  }
  if (E.treeLvl(S, 'chain') && Math.random() < 0.25) setTimeout(() => spawnGolden(), 2500);
  save();
}
function spawnGolden() { stage.spawn({ golden: true }); sfx('ding'); }

// ---------- rebuild / gear tree ----------
function minGain() { return S.stats.prestiges === 0 ? E.MIN_PRESTIGE_GAIN : 1; }
function rebuild() {
  const gain = E.prestigeGain(S); if (gain < minGain()) return;
  const beforeMult = 1 + E.GEAR_BONUS * S.gearsTotal;
  S.gears += gain; S.gearsTotal += gain; S.stats.prestiges++;
  E.freshRun(S);
  R.frenzyT = R.turboT = R.rainT = 0; R.lever = E.LEVER_FULL * 0.5; R.goldenCd = 15; R.disp = S.bank;
  stage.marbles = []; stage.jar = []; stage.setOwned(S.owned);
  $('stage').classList.remove('fold'); void $('stage').offsetWidth; $('stage').classList.add('fold');
  sfx('fanfare'); flash(); bigShake(); buzz([40, 60, 40, 60, 120]);
  setTimeout(() => stage.burst(stage.W / 2, stage.H / 3, 'confetti', 90), 500);
  checkAch(); computeBest(); R.dirty = true; save();
  closePanel();
  showModal(`<h2>Machine rebuilt!</h2><p>You earned</p><div class="amt">+${gain} ⚙</div>
    <p>Gear power: <b>×${beforeMult.toFixed(1)} → ×${(1 + E.GEAR_BONUS * S.gearsTotal).toFixed(1)}</b> sparkles, forever.<br>Spend your gears on the Gear Tree for even more.</p>
    <div class="row"><button class="buy gold" data-close>Spend gears!</button></div>`, () => openPanel('gears'));
}
function buyTree(node) {
  const l = E.treeLvl(S, node.id); if (l >= node.max) return;
  const c = E.treeCost(node, l); if (S.gears < c || !node.req.every(r => E.treeLvl(S, r) > 0)) { sfx('no'); return; }
  S.gears -= c; S.tree[node.id] = l + 1; sfx('milestone'); buzz(25); stage.burst(stage.W / 2, stage.H / 2, 'spark', 30, '#f5c542');
  if (node.id === 'keep') { S.up.golden = true; S.up.lever = true; S.up.auto = true; }
  if (node.id === 'head') { const d = (E.HEAD_BANK[l + 1] || 0) - (E.HEAD_BANK[l] || 0); if (d > 0) { S.bank += d; pop(innerWidth / 2, 120, '+' + fmt(d) + ' head start!', 'big gold'); } }
  computeBest(); R.dirty = true; R.panelSig = ''; save();
}
function checkAch() {
  for (const a of E.ACHIEVEMENTS) if (!S.ach[a.id] && a.test(S)) {
    S.ach[a.id] = Date.now(); S.achCount++; R.newAch++;
    toast('Trophy: ' + a.name, a.desc + ' · +2% sparkles forever'); sfx('jar');
  }
}

// ---------- modals (queued) ----------
const modalQ = [];
function showModal(html, onClose) { modalQ.push([html, onClose]); if (modalQ.length === 1) openModal(); }
function openModal() {
  if (!modalQ.length) return;
  const [html, onClose] = modalQ[0], m = $('modal'); $('modalCard').innerHTML = html; m.hidden = false;
  const done = (fn) => { m.hidden = true; modalQ.shift(); fn && fn(); setTimeout(openModal, 50); };
  $('modalCard').querySelectorAll('button[data-close]').forEach(b => b.addEventListener('click', () => { unlockAudio(); done(onClose); }, { once: true }));
  $('modalCard').querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => { unlockAudio(); const act = R.modalAct; R.modalAct = null; done(() => act && act(b.dataset.act)); }, { once: true }));
}
function offlineCheck() {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away < 30) return;
  const secs = Math.min(away, E.offlineCapH(S) * 3600);
  const gain = E.baseCps(S) * secs * E.offlineRate(S);
  S.lastSeen = Date.now();
  if (gain < 1) return;
  showModal(`<h2>Welcome back!</h2><p>Your machine kept clacking for ${E.fmtTime(secs)}${away > secs ? ' (max)' : ''}.</p>
    <div class="amt">+${fmt(gain)} ✦</div><div class="row"><button class="buy gold" data-close id="collect">Collect!</button></div>`, () => {
    E.earn(S, gain); stage.burst(stage.W / 2, stage.H / 2, 'confetti', 60); sfx('fanfare'); bigShake(); buzz([30, 30, 60]); R.dirty = true; save();
  });
}
function updateNotice() {
  if (!S.refund) return;
  const { sparkles, gears } = S.refund; delete S.refund;
  showModal(`<h2>New: it runs itself!</h2><p>No more PRESS button — your machine clacks on its own. Buy upgrades to make it faster, and tap marbles for bonus sparkles.</p>
    ${sparkles || gears ? `<p>Old crank upgrades were refunded:</p><div class="amt">${sparkles ? '+' + fmt(sparkles) + ' ✦' : ''}${sparkles && gears ? ' · ' : ''}${gears ? '+' + gears + ' ⚙' : ''}</div>` : ''}
    <div class="row"><button class="buy gold" data-close>Cool!</button></div>`);
}

// ---------- simulation step ----------
function logic(dt, visual = true) {
  const cps = cpsNow();
  E.earn(S, cps * dt);
  if (!visual) E.earn(S, (E.incomeRate(S, cps) - cps) * dt); // headless: average jar bonus
  S.stats.playTime += dt;
  if (visual) { // production marbles flow continuously
    R.spawnAcc += dt * E.marblesPerSec(S); R.pendingVis += cps * dt;
    while (R.spawnAcc >= 1) { R.spawnAcc -= 1; stage.spawn({ value: R.pendingVis }); R.pendingVis = 0; }
  }
  R.frenzyT = Math.max(0, R.frenzyT - dt); R.turboT = Math.max(0, R.turboT - dt); R.rainT = Math.max(0, R.rainT - dt);
  if (E.leverUnlocked(S) && R.turboT <= 0) R.lever = Math.min(E.LEVER_FULL, R.lever + E.leverRate(S) * dt);
  if (E.goldenUnlocked(S)) { R.goldenCd -= dt; if (R.goldenCd <= 0) { R.goldenCd = E.goldenInterval(S) * (0.6 + 0.8 * Math.random()); if (visual) spawnGolden(); } }
  // Auto-Builder
  if (E.autoUnlocked(S) && S.autoOn) {
    R.autoT += dt;
    if (R.autoT >= E.autoInterval(S)) {
      R.autoT = 0; const b = R.best || computeBest();
      if (b && S.bank >= b.cost) { const el = visual ? tileFor(b.key) : null; if (buyItem(b, el, true) && visual) { const a = $('autoBtn'); a.classList.remove('tick'); void a.offsetWidth; a.classList.add('tick'); } }
    }
  }
  R.bestT += dt; if (R.bestT > 0.25) { R.bestT = 0; computeBest(); }
  R.achT += dt; if (R.achT > 0.5) { R.achT = 0; checkAch(); }
}

// ---------- icons ----------
const iconCache = {};
function iconURL(id, color) {
  const key = id + color;
  if (iconCache[key]) return iconCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 96; const k = c.getContext('2d');
  const disc = (x, y, r, f) => { k.fillStyle = f; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); };
  const shine = (x, y) => { k.fillStyle = 'rgba(255,255,255,.75)'; k.beginPath(); k.ellipse(x, y, 7, 4, -.6, 0, 7); k.fill(); };
  k.lineJoin = k.lineCap = 'round';
  switch (id) {
    case 'oil': k.fillStyle = '#2a8478'; k.fillRect(24, 40, 44, 40); k.fillStyle = '#3fb6a8'; k.fillRect(24, 36, 44, 38); k.strokeStyle = '#3b2a22'; k.lineWidth = 6; k.beginPath(); k.moveTo(60, 40); k.lineTo(80, 18); k.stroke(); k.beginPath(); k.arc(46, 34, 10, Math.PI, 0); k.stroke(); disc(84, 30, 5, '#f5c542'); k.fillStyle = '#fffaf0'; k.fillRect(32, 48, 28, 10); break;
    case 'golden': disc(48, 50, 30, '#ffd23f'); disc(52, 56, 26, '#e5ad1c'); disc(48, 50, 24, '#ffd23f'); shine(38, 40); k.fillStyle = '#fff'; k.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 13; k.lineTo(48 + Math.cos(a) * r, 52 + Math.sin(a) * r); } k.fill(); break;
    case 'lever': k.fillStyle = '#8a6340'; k.fillRect(22, 70, 52, 14); k.strokeStyle = '#7a604f'; k.lineWidth = 8; k.beginPath(); k.moveTo(48, 74); k.lineTo(66, 26); k.stroke(); disc(67, 24, 12, '#e8574b'); shine(63, 19); break;
    case 'auto': case 'auto2': k.fillStyle = '#4fa3e0'; k.fillRect(22, 30, 52, 44); k.fillStyle = '#2f76ad'; k.fillRect(22, 66, 52, 8); disc(38, 50, 8, '#fffaf0'); disc(58, 50, 8, '#fffaf0'); disc(38, 50, 4, '#3b2a22'); disc(58, 50, 4, '#3b2a22'); k.strokeStyle = '#3b2a22'; k.lineWidth = 4; k.beginPath(); k.moveTo(48, 30); k.lineTo(48, 16); k.stroke(); disc(48, 14, 6, '#e8574b');
      if (id === 'auto2') { k.strokeStyle = '#f5c542'; k.lineWidth = 5; [30, 46, 62].forEach(y => { k.beginPath(); k.moveTo(6, y); k.lineTo(16, y); k.stroke(); }); } break;
    case 'bigjar': k.fillStyle = 'rgba(200,230,240,.8)'; k.fillRect(22, 30, 52, 52); ['#e8574b', '#4fa3e0', '#f5c542', '#3fb6a8', '#8e6bd8', '#ef7fb0'].forEach((f, i) => disc(32 + (i % 3) * 16, 72 - Math.floor(i / 3) * 15, 7, f)); k.fillStyle = '#c79b6a'; k.fillRect(18, 24, 60, 9); break;
    case 'popper': k.fillStyle = '#f5c542'; k.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 14 : 36; k.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r); } k.fill(); disc(48, 48, 10, '#fffaf0'); break;
    case 'magnet': k.strokeStyle = '#e8574b'; k.lineWidth = 16; k.beginPath(); k.arc(48, 46, 22, Math.PI, 0, true); k.stroke(); k.fillStyle = '#d8ccb6'; k.fillRect(18, 38, 16, 12); k.fillRect(62, 38, 16, 12); disc(48, 22, 7, '#ffd23f'); break;
    case 'frenzy2': k.fillStyle = '#f5c542'; k.strokeStyle = '#c99a1f'; k.lineWidth = 4; k.beginPath(); k.moveTo(56, 10); k.lineTo(26, 54); k.lineTo(46, 54); k.lineTo(38, 86); k.lineTo(72, 38); k.lineTo(52, 38); k.closePath(); k.fill(); k.stroke(); break;
    case 'next': drawGadget(k, color, 48, 48, 70, 0.9, '#9b8b70'); break;
    default: drawGadget(k, id, 48, 48, 70, 0.9, color);
  }
  return (iconCache[key] = c.toDataURL());
}
function upgIcon(u) {
  if (u.kind === 'prod') { const p = E.PRODUCERS[u.prod]; return iconURL(p.id, p.color); }
  if (u.kind === 'global') return iconURL('oil', '');
  return iconURL(u.id, '');
}

// ---------- shop grid: 12 fixed tiles, never scrolls ----------
const grid = $('grid');
const tiles = [];
for (let k = 0; k < 12; k++) {
  const t = document.createElement('button'); t.className = 'tile empty'; t.dataset.k = k;
  t.innerHTML = '<div class="ic"><img alt="" draggable="false"><span class="own"></span></div><div class="nm"></div><div class="pr"></div><div class="ms"><i></i></div>';
  grid.appendChild(t); tiles.push(t);
}
function slotList() {
  const out = [];
  if (R.tab === 'gadgets') {
    let next = -1;
    E.PRODUCERS.forEach((p, i) => { if (E.producerVisible(S, i)) out.push({ type: 'p', i, key: 'p' + i }); else if (next < 0) next = i; });
    if (next >= 0 && out.length < 12) out.push({ type: 'next', i: next, key: 'n' + next });
  } else {
    const ups = availableUpgrades();
    if (!ups.length) out.push({ type: 'info', key: 'info' });
    for (const u of ups.slice(0, 12)) out.push({ type: 'u', id: u.id, key: 'u' + u.id });
  }
  const room = out[0].type === 'info' ? 9 : 12;
  while (out.length < room) out.push({ type: 'empty', key: 'e' + out.length });
  return out.slice(0, room);
}
function tileFor(key) { const k = R.slots.findIndex(s => s.key === key); return k >= 0 ? tiles[k] : null; }
const seen = new Set();
function layoutTiles() {
  const list = slotList();
  list.forEach((it, k) => {
    const t = tiles[k], old = R.slots[k];
    if (old && old.key === it.key && !R.forceLayout) return;
    t.className = 'tile ' + it.type; t.title = ''; t.style.gridColumn = '';
    const img = t.querySelector('img'), nm = t.querySelector('.nm');
    if (it.type === 'p') { const p = E.PRODUCERS[it.i]; img.src = iconURL(p.id, p.color); nm.textContent = p.name; t.title = p.desc; }
    else if (it.type === 'u') { const u = E.UPG_BY_ID[it.id]; img.src = upgIcon(u); nm.textContent = u.short; t.title = `${u.name}: ${u.desc}`; if (u.kind === 'unlock') t.classList.add('gold'); }
    else if (it.type === 'next') { const p = E.PRODUCERS[it.i]; img.src = iconURL('next', p.id); nm.textContent = 'Next gadget'; }
    else if (it.type === 'info') { img.removeAttribute('src'); nm.textContent = 'New upgrades appear as your machine grows!'; }
    else { img.removeAttribute('src'); nm.textContent = ''; }
    t.querySelector('.own').textContent = ''; t.querySelector('.pr').textContent = '';
    if ((it.type === 'p' || it.type === 'u') && !seen.has(it.key)) { if (R.slots.length) t.classList.add('new'); }
    seen.add(it.key);
  });
  tiles.forEach((t, k) => { t.hidden = k >= list.length; });
  R.slots = list; R.forceLayout = false;
}
function updateTiles() {
  layoutTiles();
  const bestKey = R.best && R.best.key;
  R.slots.forEach((it, k) => {
    const t = tiles[k];
    if (it.type === 'p') {
      const i = it.i, n = buyCount(i), cost = E.producerCost(S, i, n), can = S.bank >= cost;
      t.classList.toggle('can', can); t.classList.toggle('best', bestKey === it.key);
      t.querySelector('.own').textContent = S.owned[i] || '';
      const pr = (n > 1 ? `×${n} ` : '') + fmt(cost); const pe = t.querySelector('.pr'); if (pe.textContent !== pr) pe.textContent = pr;
      const nmM = E.nextMilestone(S.owned[i]), prevM = [0, ...E.MILESTONES].filter(x => x <= S.owned[i]).pop();
      t.querySelector('.ms i').style.width = nmM ? ((S.owned[i] - prevM) / (nmM - prevM) * 100) + '%' : '100%';
    } else if (it.type === 'u') {
      const u = E.UPG_BY_ID[it.id], cost = E.upgCost(S, u), can = S.bank >= cost;
      t.classList.toggle('can', can); t.classList.toggle('best', bestKey === it.key);
      const pr = fmt(cost); const pe = t.querySelector('.pr'); if (pe.textContent !== pr) pe.textContent = pr;
      t.querySelector('.ms i').style.width = '0';
    } else if (it.type === 'next') {
      const need = E.PRODUCERS[it.i].cost * 0.6;
      t.querySelector('.pr').textContent = `at ${fmt(need)} earned`;
      t.querySelector('.ms i').style.width = Math.min(100, S.runEarned / need * 100) + '%';
    }
  });
}
function setTab(tab) {
  R.tab = tab; document.querySelectorAll('#shopTabs > button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('buyMode').classList.toggle('off', tab !== 'gadgets'); R.slots = []; layoutTiles(); updateTiles();
}
document.querySelectorAll('#shopTabs > button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); sfx('tab'); setTab(b.dataset.tab); }));
document.querySelectorAll('#buyMode button').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault(); R.buyN = b.dataset.n === 'max' ? 'max' : +b.dataset.n; document.querySelectorAll('#buyMode button').forEach(q => q.classList.toggle('on', q === b)); sfx('tab'); updateTiles();
}));

// press a tile: instant buy on pointerdown; holding repeats faster and faster. Every finger is tracked on its own.
const holds = new Map();
function pressTile(k, repeat) {
  const it = R.slots[k], t = tiles[k]; if (!it) return;
  let ok = false;
  if (it.type === 'p') ok = buyProducer(it.i, t);
  else if (it.type === 'u') ok = buyUpgrade(E.UPG_BY_ID[it.id], t);
  else if (it.type === 'next') { if (!repeat) { const [x, y] = elCenter(t); pop(x, y, 'Keep going!', 'sm'); sfx('no'); } return; }
  else return;
  if (!ok && !repeat) { sfx('no'); buzz(5); t.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 160 }); }
  if (ok) updateTiles();
}
grid.addEventListener('pointerdown', e => {
  const t = e.target.closest('.tile'); if (!t) return;
  e.preventDefault(); unlockAudio();
  const k = +t.dataset.k;
  try { t.setPointerCapture(e.pointerId); } catch (err) { }
  const h = { k, n: 0, timer: 0 }; holds.set(e.pointerId, h);
  pressTile(k, false);
  const rep = () => { if (!holds.has(e.pointerId)) return; h.n++; pressTile(k, true); h.timer = setTimeout(rep, Math.max(40, 160 * Math.pow(0.85, h.n))); };
  h.timer = setTimeout(rep, 320);
});
const endHold = e => { const h = holds.get(e.pointerId); if (h) { clearTimeout(h.timer); holds.delete(e.pointerId); } };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => grid.addEventListener(ev, endHold));
addEventListener('blur', () => { holds.forEach(h => clearTimeout(h.timer)); holds.clear(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- boost row ----------
$('turbo').addEventListener('pointerdown', e => {
  e.preventDefault(); unlockAudio();
  if (R.lever >= E.LEVER_FULL && R.turboT <= 0) { R.turboT = 15; R.lever = 0; S.stats.levers++; banner('TURBO!', '×3 everything for 15s'); sfx('lever'); bigShake(); buzz([20, 20, 80]); stage.shake(6); }
  else { sfx('no'); const [x, y] = elCenter($('turbo')); pop(x, y, R.turboT > 0 ? 'Whoosh!' : 'Charging…', 'sm'); }
});
$('autoBtn').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); S.autoOn = !S.autoOn; sfx('tab'); R.autoT = 0; save(); updateUI(); });
$('goal').addEventListener('pointerdown', e => {
  e.preventDefault(); unlockAudio(); const b = R.best; if (!b) return;
  if (S.bank >= b.cost) { buyItem(b, tileFor(b.key) || $('goal')); updateTiles(); }
  else if (b.tab !== R.tab) { setTab(b.tab); sfx('tab'); }
  else { const t = tileFor(b.key); if (t) t.animate([{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 300 }); sfx('tab'); }
});

// ---------- panels: rebuild + gear tree, trophies (sized to fit, no scrolling) ----------
function openPanel(kind) { R.panel = kind; R.panelSig = ''; $('panel').hidden = false; if (kind === 'trophies') R.newAch = 0; renderPanel(); }
function closePanel() { R.panel = null; $('panel').hidden = true; }
$('panelClose').addEventListener('click', () => { sfx('tab'); closePanel(); });
$('panel').addEventListener('pointerdown', e => { if (e.target === $('panel')) closePanel(); });
$('gearChip').addEventListener('click', () => { unlockAudio(); sfx('tab'); openPanel('gears'); });
$('trophyBtn').addEventListener('click', () => { unlockAudio(); sfx('tab'); openPanel('trophies'); });
function renderPanel() {
  if (!R.panel) return;
  const body = $('panelBody');
  if (R.panel === 'gears') {
    const sig = 'g' + S.gears + JSON.stringify(S.tree) + (E.prestigeGain(S) >= minGain());
    if (sig !== R.panelSig) {
      R.panelSig = sig;
      body.innerHTML = `<h2>Rebuild the machine</h2>
        <div class="rb"><div class="big" id="rbGain">+0 ⚙</div><div class="mid">Each gear ever earned = <b>+10% sparkles forever</b> (now ×${(1 + E.GEAR_BONUS * S.gearsTotal).toFixed(1)}). Gadgets reset; gears, tree &amp; trophies stay.<div class="bar"><i id="rbBar"></i></div></div><button class="buy" id="rbBtn"></button></div>
        <div class="sec">GEAR TREE · <span id="gearsLeft">${S.gears}</span> ⚙ TO SPEND</div><div class="tree" id="tree"><svg></svg></div>`;
      const tree = $('tree'), nodes = {};
      for (const n of E.TREE) {
        const l = E.treeLvl(S, n.id), open = n.req.every(r => E.treeLvl(S, r) > 0), maxed = l >= n.max, cost = maxed ? 0 : E.treeCost(n, l);
        const d = document.createElement('div'); d.className = 'node' + (open ? '' : ' locked') + (maxed ? ' maxed' : '');
        d.style.gridColumn = String(n.x + 2); d.style.gridRow = String(n.y + 1);
        const dots = n.max <= 5 ? `<div class="lv">${Array.from({ length: n.max }, (_, k) => `<i class="${k < l ? 'on' : ''}"></i>`).join('')}</div>` : `<div class="lv">Lv ${l}</div>`;
        d.innerHTML = `<b>${n.name}</b>${dots}<div class="ds">${n.desc(maxed ? l : l + 1)}</div><button class="buy ${!maxed && open && S.gears >= cost ? 'gold' : 'no'}">${maxed ? 'MAX' : cost + ' ⚙'}</button>`;
        d.querySelector('button').addEventListener('click', () => buyTree(n));
        tree.appendChild(d); nodes[n.id] = d;
      }
      $('rbBtn').addEventListener('click', () => {
        if (E.prestigeGain(S) < minGain()) { sfx('no'); return; }
        R.modalAct = a => { if (a === 'yes') rebuild(); };
        showModal(`<h2>Rebuild?</h2><p>Fold up this machine and build a bigger one.</p><div class="amt">+${E.prestigeGain(S)} ⚙</div><p>You keep gears, the Gear Tree and trophies.</p>
          <div class="row"><button class="buy no" data-close>Not yet</button><button class="buy red" data-act="yes">Rebuild!</button></div>`);
      });
      requestAnimationFrame(() => {
        const tr = tree.getBoundingClientRect(); let html = '';
        for (const n of E.TREE) for (const r of n.req) { const a = nodes[r].getBoundingClientRect(), b = nodes[n.id].getBoundingClientRect();
          html += `<line x1="${a.left + a.width / 2 - tr.left}" y1="${a.bottom - tr.top}" x2="${b.left + b.width / 2 - tr.left}" y2="${b.top - tr.top}" stroke="${E.treeLvl(S, r) ? '#c99a1f' : '#d8ccb6'}" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round"/>`; }
        tree.querySelector('svg').innerHTML = html;
      });
    }
    const gain = E.prestigeGain(S), can = gain >= minGain();
    $('rbGain').textContent = '+' + gain + ' ⚙';
    const a = E.lifetimeForGears(E.gearsFor(S.lifetime)), b = E.lifetimeForGears(E.gearsFor(S.lifetime) + 1);
    $('rbBar').style.width = Math.max(0, Math.min(100, (S.lifetime - a) / (b - a) * 100)) + '%';
    const btn = $('rbBtn'); btn.className = 'buy ' + (can ? 'red' : 'no');
    const txt = can ? 'Rebuild!' : `Need ${minGain()}`; if (btn.textContent !== txt) btn.textContent = txt;
  } else {
    const sig = 't' + S.achCount + (R.troSel || '');
    if (sig === R.panelSig) return; R.panelSig = sig;
    const sel = E.ACHIEVEMENTS.find(a => a.id === R.troSel);
    body.innerHTML = `<h2>Trophies</h2><div class="sec" style="margin-top:0">${S.achCount} / ${E.ACHIEVEMENTS.length} · +${S.achCount * 2}% SPARKLES FOREVER</div>
      <div class="trophies">${E.ACHIEVEMENTS.map(a => `<button class="tro${S.ach[a.id] ? '' : ' lock'}${a.id === R.troSel ? ' sel' : ''}" data-id="${a.id}">${S.ach[a.id] ? '★' : '?'}</button>`).join('')}</div>
      <div class="troInfo">${sel ? `<b>${S.ach[sel.id] ? sel.name : '???'}</b>${sel.desc}` : '<b>Tap a medal</b>to see how to win it.'}</div>
      <div class="stats">Marbles popped: ${fmt(S.stats.pops || 0)} · Golden caught: ${S.stats.golden} · Rebuilds: ${S.stats.prestiges}<br>Played: ${E.fmtTime(S.stats.playTime)} · Total sparkles: ${fmt(S.lifetime)}<br><button class="buy no" id="wipe">Erase save…</button></div>`;
    body.querySelectorAll('.tro').forEach(b => b.addEventListener('click', () => { R.troSel = b.dataset.id; sfx('tab'); renderPanel(); }));
    $('wipe').addEventListener('click', () => {
      R.modalAct = a => { if (a === 'wipe') { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.bak'); S = E.newState(); R.disp = S.bank; stage.marbles = []; stage.jar = []; stage.setOwned(S.owned); closePanel(); setTab('gadgets'); computeBest(); } };
      showModal(`<h2>Erase everything?</h2><p>This deletes all progress, gears and trophies. It can't be undone.</p><div class="row"><button class="buy" data-close>Keep it</button><button class="buy red" data-act="wipe">Erase</button></div>`);
    });
  }
}

// ---------- per-frame HUD ----------
function setDot(el, n) { const d = el.querySelector('.dot'); if (!d) return; d.hidden = !n; const t = n > 9 ? '9+' : String(n); if (n && d.textContent !== t) d.textContent = t; }
function updateUI() {
  if (S.bank < R.disp) R.disp = S.bank; else R.disp += (S.bank - R.disp) * 0.3;
  const txt = fmt(R.disp); const be = $('bank'); if (be.textContent !== txt) be.textContent = txt;
  const bm = boostMult(); const ct = `${fmt(cpsNow(), 1)} / sec${bm > 1 ? ` <b>×${bm}!</b>` : ''}`; if ($('cps').innerHTML !== ct) $('cps').innerHTML = ct;
  // turbo
  const tb = $('turbo'), tu = E.leverUnlocked(S); tb.hidden = !tu;
  if (tu) { $('turboFill').style.width = (R.turboT > 0 ? R.turboT / 15 * 100 : R.lever / E.LEVER_FULL * 100) + '%'; const ready = R.lever >= E.LEVER_FULL && R.turboT <= 0;
    tb.classList.toggle('ready', ready); tb.classList.toggle('active', R.turboT > 0); $('turboTxt').textContent = R.turboT > 0 ? Math.ceil(R.turboT) + 's' : ready ? 'PULL!' : Math.floor(R.lever / E.LEVER_FULL * 100) + '%'; }
  // auto
  const ab = $('autoBtn'), au = E.autoUnlocked(S); ab.hidden = !au;
  if (au) { ab.classList.toggle('on', !!S.autoOn); $('autoTxt').textContent = S.autoOn ? 'ON' : 'OFF'; }
  // goal = best buy
  const g = R.best;
  if (g) { const can = S.bank >= g.cost; $('goalLbl').textContent = 'BEST'; $('goalName').textContent = g.name;
    $('goalBar').style.width = Math.min(100, S.bank / g.cost * 100) + '%'; $('goalBar').style.background = can ? 'var(--red)' : 'var(--teal)';
    $('goalEta').textContent = can ? 'tap to buy!' : `${fmt(g.cost)} · ${E.fmtTime((g.cost - S.bank) / Math.max(incomeEstimate(), 0.1))}`; }
  // tabs: dots for affordable, star where the best buy lives
  const nP = E.PRODUCERS.filter((_, i) => E.producerVisible(S, i) && S.bank >= E.producerCost(S, i)).length;
  const nU = availableUpgrades().filter(u => S.bank >= E.upgCost(S, u)).length;
  const tg = document.querySelector('[data-tab=gadgets]'), tu2 = document.querySelector('[data-tab=upgrades]');
  setDot(tg, R.tab === 'gadgets' ? 0 : nP); setDot(tu2, R.tab === 'upgrades' ? 0 : nU);
  tg.classList.toggle('star', !!g && g.tab === 'gadgets' && R.tab !== 'gadgets'); tu2.classList.toggle('star', !!g && g.tab === 'upgrades' && R.tab !== 'upgrades');
  // gear chip + trophies
  const gain = E.prestigeGain(S), chip = $('gearChip');
  chip.hidden = !(S.gearsTotal > 0 || gain > 0 || S.lifetime >= 3e8);
  $('gearCount').textContent = S.gears; $('gearGain').textContent = gain > 0 ? '+' + gain : '';
  chip.classList.toggle('ready', gain >= minGain());
  setDot(chip, E.TREE.filter(n => E.treeLvl(S, n.id) < n.max && n.req.every(r => E.treeLvl(S, r) > 0) && S.gears >= E.treeCost(n, E.treeLvl(S, n.id))).length);
  $('trophyBtn').hidden = S.achCount === 0; setDot($('trophyBtn'), R.newAch);
  // buffs
  const buffs = [['frenzy', R.frenzyT, E.frenzyDur(S), `FRENZY ×${E.frenzyMult(S)}`], ['turbo', R.turboT, 15, 'TURBO ×3']];
  const bx = $('buffs');
  for (const [id, t, max, label] of buffs) { let el = bx.querySelector('.' + id); if (t > 0) { if (!el) { el = document.createElement('div'); el.className = 'buff ' + id; el.innerHTML = `${label} <span></span><i></i>`; bx.appendChild(el); } el.querySelector('span').textContent = Math.ceil(t) + 's'; el.querySelector('i').style.width = (t / max * 100) + '%'; } else if (el) el.remove(); }
  stage.boost = (R.frenzyT > 0 || R.turboT > 0) ? 1 : 0;
  stage.flow = 1 + 0.12 * Math.log10(1 + E.totalOwned(S));
  $('stageHint').hidden = !((performance.now() - R.startT > 15000) && (S.stats.pops || 0) < 8);
  updateTiles(); renderPanel();
}

// ---------- stage input: every finger pops marbles / catches gold ----------
const fingers = new Set();
function stagePoke(e) {
  const r = $('cv').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const g = stage.hitGolden(x, y); if (g) { catchGolden(g); return; }
  const m = stage.hitMarble(x, y, e.type === 'pointerdown' ? 24 : 14); if (!m) return;
  stage.popMarble(m);
  const v = Math.max(1, (m.mini ? 2 : E.popSecs(S)) * cpsNow()); E.earn(S, v); S.stats.pops = (S.stats.pops || 0) + 1;
  sfx('pop'); buzz(6);
  if (R.popBudget >= 1 || m.mini) { R.popBudget = Math.max(0, R.popBudget - 1); pop(e.clientX, e.clientY - 18, '+' + fmt(v, 1), m.mini ? 'mid gold' : 'sm'); }
}
$('cv').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); fingers.add(e.pointerId); try { $('cv').setPointerCapture(e.pointerId); } catch (err) { } stagePoke(e); });
$('cv').addEventListener('pointermove', e => { if (fingers.has(e.pointerId)) stagePoke(e); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => $('cv').addEventListener(ev, e => fingers.delete(e.pointerId)));

$('muteBtn').addEventListener('click', () => { S.muted = !S.muted; setMuted(S.muted); $('muteBtn').classList.toggle('off', S.muted); unlockAudio(); sfx('tab'); save(); });
$('muteBtn').classList.toggle('off', S.muted);

// stage callbacks
stage.onLand = m => {
  sfx('land');
  if (m.mini) { const v = cpsNow(); E.earn(S, v); const [x, y] = stage.toScreen(m.x, m.y - 14); pop(x, y, '+' + fmt(v, 1), 'sm gold'); return; }
  if (m.value > 0 && R.popBudget >= 1) { R.popBudget--; const [x, y] = stage.toScreen(m.x, m.y - 14); pop(x, y, '+' + fmt(m.value, 1), 'sm'); }
  if (m.golden && !R.hintGold) { R.hintGold = true; const [x, y] = stage.toScreen(m.x, m.y - 30); pop(x, y, 'Tap the gold one!', 'mid gold'); }
};
stage.onClack = () => sfx('clack');
stage.onGadget = (id) => { if (id === 'bell') sfx('ding'); else if (id === 'spring') sfx('boing'); };
stage.onJarFull = () => {
  const bonus = Math.max(5, E.jarSecs(S) * cpsNow()); E.earn(S, bonus);
  const [x, y] = jarScreen(); pop(x, y - 20, 'JAR FULL! +' + fmt(bonus), 'mid gold'); sfx('jar'); buzz(20); stage.burst(stage.jarBox.x + stage.jarBox.w / 2, stage.jarBox.y, 'confetti', 30);
};

// ---------- main loop ----------
let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  logic(dt);
  R.popBudget = Math.min(4, R.popBudget + dt * 3);
  stage.update(dt); stage.draw();
  R.uiT += dt; if (R.uiT > 0.08 || R.dirty) { R.uiT = 0; R.dirty = false; updateUI(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { offlineCheck(); last = performance.now(); } });
addEventListener('pagehide', save);

// ---------- boot ----------
updateNotice();
offlineCheck();
computeBest(); setTab('gadgets'); updateUI();
requestAnimationFrame(frame);
if (S.lifetime === 0) setTimeout(() => banner('It runs itself!', 'Buy gadgets to make it faster'), 700);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

// automation / debugging hook (used by test/play.mjs)
window.CW = {
  get S() { return S; }, E, R, stage, tiles,
  advance(sec) { for (let t = 0; t < sec; t += 0.1) logic(0.1, false); R.dirty = true; },
  rebuild, save, spawnGolden, setTab, computeBest, openPanel, closePanel,
};
