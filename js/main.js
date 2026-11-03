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
setMuted(S.muted);

const stage = new Stage($('cv'), E.PRODUCERS);
stage.setOwned(S.owned);
const R = { combo: 1, lastTap: 0, lever: 0, frenzyT: 0, turboT: 0, stormT: 0, goldenCd: 20, tab: 'gadgets', buyN: 1, disp: S.bank,
  spawnAcc: 0, pendingVis: 0, windAcc: 0, popBudget: 0, seen: new Set(), sig: '', achT: 0, hintGold: false, py: 0, pv: 0, uiT: 0 };

// ---------- helpers ----------
const fmt = E.fmt;
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
function boostMult() { return (R.frenzyT > 0 ? E.frenzyMult(S) : 1) * (R.turboT > 0 ? 3 : 1); }
function cpsNow() { return E.baseCps(S) * boostMult(); }
function tapVal() { return E.tapValue(S, cpsNow()) * (R.stormT > 0 ? 25 : 1); }
function incomeEstimate() { return cpsNow() + tapVal() * (E.windupRate(S) + 1.5); }
function pop(x, y, text, cls = 'sm') {
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  el.style.left = x + (Math.random() * 30 - 15) + 'px'; el.style.top = y + 'px'; $('pops').appendChild(el);
  setTimeout(() => el.remove(), 950);
  const all = $('pops').children; if (all.length > 28) all[0].remove();
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

// ---------- core actions ----------
function doTap(sx, sy, auto = false) {
  const now = performance.now();
  if (!auto) {
    const echo = 1 + E.treeLvl(S, 'combo');
    R.combo = (now - R.lastTap < 700 + 150 * echo) ? Math.min(E.comboMax(S), R.combo + 0.12 * echo) : Math.max(1, R.combo);
    R.lastTap = now; S.stats.taps++; S.stats.bestCombo = Math.max(S.stats.bestCombo, Math.floor(R.combo));
    if (S.up.lever && R.turboT <= 0) R.lever = Math.min(150, R.lever + 1);
  }
  const v = tapVal() * (auto ? 1 : R.combo);
  E.earn(S, v);
  stage.spawn({ tap: true, value: 0, quiet: auto, v: auto ? 90 : 140 + R.combo * 20 });
  if (!auto) {
    const big = R.combo >= 4 || R.stormT > 0;
    pop(sx, sy - 30, '+' + fmt(v, 1), big ? 'mid' + (R.stormT > 0 ? ' gold' : '') : 'sm');
    sfx('press', R.combo); buzz(8);
    R.py = 10; R.pv = 0;
    if (R.combo >= E.comboMax(S) && Math.random() < 0.15) stage.burst(stage.W * 0.17, stage.H * 0.1, 'spark', 6, '#f5c542');
  } else { R.py = Math.max(R.py, 4); }
}

function catchGolden(m, sx, sy) {
  stage.catchGolden(m); S.stats.golden++; sfx('gold'); buzz([30, 40, 70]); flash(); bigShake();
  const r = Math.random();
  if (r < 0.5) { R.frenzyT = E.frenzyDur(S); S.stats.frenzies++; banner('FRENZY!', `×${E.frenzyMult(S)} sparkles for ${E.frenzyDur(S)}s`); }
  else if (r < 0.85) {
    const gain = Math.max(60 * incomeEstimate(), Math.min(0.15 * S.bank, 900 * E.baseCps(S))) + 20;
    E.earn(S, gain); banner('MARBLE SHOWER!', '+' + fmt(gain) + ' sparkles'); pop(sx, sy, '+' + fmt(gain), 'big gold');
    for (let i = 0; i < 12; i++) setTimeout(() => stage.spawn({ value: 0, quiet: true, v: 200 }), i * 90);
  } else { R.stormT = 12; banner('TAP STORM!', 'Taps ×25 for 12s — tap tap tap!'); }
  if (E.treeLvl(S, 'chain') && Math.random() < 0.25) setTimeout(() => spawnGolden(), 2500);
  save();
}
function spawnGolden() { stage.spawn({ golden: true }); sfx('ding'); }

function buyCount(i) {
  if (R.buyN === 'max') return Math.max(1, E.maxAffordable(S, i));
  return R.buyN;
}
function buyProducer(i, el) {
  const n = buyCount(i), cost = E.producerCost(S, i, n);
  if (S.bank < cost) { sfx('no'); return; }
  const before = S.owned[i]; S.bank -= cost; S.owned[i] += n;
  const p = E.PRODUCERS[i]; sfx('buy'); buzz(15);
  if (el) { const r = el.getBoundingClientRect(); pop(r.left + r.width / 2, r.top, '+' + n, 'mid'); }
  stage.setOwned(S.owned);
  const an = stage.anchor[p.id]; if (an) stage.burst(an[0], an[1], 'confetti', before === 0 ? 30 : 8);
  if (before === 0) { banner('NEW GADGET!', p.name); sfx('milestone'); stage.shake(5); }
  for (const t of E.MILESTONES) if (before < t && S.owned[i] >= t) {
    setTimeout(() => { banner(`${p.name} ×2!`, `${t} owned — milestone!`); sfx('milestone'); bigShake(); stage.burst(stage.W / 2, stage.H * .4, 'confetti', 50); buzz([20, 30, 20]); }, before === 0 ? 900 : 0);
    break;
  }
  refreshSoon();
}
function buyUpgrade(u, el) {
  const cost = E.upgCost(S, u); if (S.bank < cost || S.up[u.id]) { sfx('no'); return; }
  S.bank -= cost; S.up[u.id] = true; sfx('buy'); buzz(20);
  if (el) { const r = el.getBoundingClientRect(); pop(r.left + r.width / 2, r.top, '✓', 'mid'); }
  if (u.kind === 'unlock') {
    banner('UNLOCKED!', u.name); sfx('milestone'); stage.burst(stage.W / 2, stage.H / 2, 'confetti', 40); bigShake();
    if (u.id === 'golden') R.goldenCd = 3;
  }
  refreshSoon();
}

function rebuild() {
  const gain = E.prestigeGain(S); if (gain < minGain()) return;
  const beforeMult = 1 + E.GEAR_BONUS * S.gearsTotal;
  S.gears += gain; S.gearsTotal += gain; S.stats.prestiges++;
  E.freshRun(S);
  R.frenzyT = R.turboT = R.stormT = 0; R.lever = 0; R.combo = 1; R.goldenCd = 15; R.disp = S.bank;
  stage.marbles = []; stage.jar = []; stage.setOwned(S.owned);
  $('stage').classList.remove('fold'); void $('stage').offsetWidth; $('stage').classList.add('fold');
  sfx('fanfare'); flash(); bigShake(); buzz([40, 60, 40, 60, 120]);
  setTimeout(() => stage.burst(stage.W / 2, stage.H / 3, 'confetti', 90), 500);
  checkAch(); save();
  showModal(`<h2>Machine rebuilt!</h2><p>You earned</p><div class="amt">+${gain} ⚙</div>
    <p>Gear power: <b>×${beforeMult.toFixed(1)} → ×${(1 + E.GEAR_BONUS * S.gearsTotal).toFixed(1)}</b> sparkles, forever.<br>Spend your gears on the Gear Tree for even more.</p>
    <div class="row"><button class="buy gold" data-close>Let's go!</button></div>`);
  setTab('gears');
}
function minGain() { return S.stats.prestiges === 0 ? E.MIN_PRESTIGE_GAIN : 1; }

function buyTree(node) {
  const l = E.treeLvl(S, node.id); if (l >= node.max) return;
  const c = E.treeCost(node, l); if (S.gears < c || !node.req.every(r => E.treeLvl(S, r) > 0)) { sfx('no'); return; }
  S.gears -= c; S.tree[node.id] = l + 1; sfx('milestone'); buzz(25); stage.burst(stage.W / 2, stage.H / 2, 'spark', 30, '#f5c542');
  if (node.id === 'keep') { S.up.windup = true; S.up.golden = true; }
  if (node.id === 'head') { const d = (E.HEAD_BANK[l + 1] || 0) - (E.HEAD_BANK[l] || 0); if (d > 0) { S.bank += d; pop(innerWidth / 2, 120, '+' + fmt(d) + ' head start!', 'big gold'); } }
  refreshSoon(); save();
}

function checkAch() {
  for (const a of E.ACHIEVEMENTS) if (!S.ach[a.id] && a.test(S)) {
    S.ach[a.id] = Date.now(); S.achCount++; R.newAch = (R.newAch || 0) + 1;
    toast('Trophy: ' + a.name, a.desc + ' · +2% sparkles forever'); sfx('jar');
  }
}

// ---------- offline ----------
function offlineCheck() {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away < 30) return;
  const secs = Math.min(away, E.offlineCapH(S) * 3600);
  const gain = E.baseCps(S) * secs * E.offlineRate(S);
  if (gain < 1) return;
  S.lastSeen = Date.now();
  showModal(`<h2>Welcome back!</h2><p>Your machine kept clacking for ${E.fmtTime(secs)}${away > secs ? ' (max)' : ''}.</p>
    <div class="amt">+${fmt(gain)} ✦</div><div class="row"><button class="buy gold" id="collect">Collect!</button></div>`, () => {
    E.earn(S, gain); stage.burst(stage.W / 2, stage.H / 2, 'confetti', 60); sfx('fanfare'); bigShake(); buzz([30, 30, 60]); save();
  });
}
function showModal(html, onClose) {
  const m = $('modal'); $('modalCard').innerHTML = html; m.hidden = false;
  const close = () => { m.hidden = true; onClose && onClose(); };
  $('modalCard').querySelectorAll('button[data-close], #collect').forEach(b => b.addEventListener('click', () => { unlockAudio(); close(); }, { once: true }));
  $('modalCard').querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => { m.hidden = true; R.modalAct && R.modalAct(b.dataset.act); }, { once: true }));
}

// ---------- simulation step ----------
function logic(dt, visual = true) {
  const cps = cpsNow();
  E.earn(S, cps * dt);
  S.stats.playTime += dt;
  // production marbles
  if (visual) {
    const tot = S.owned.reduce((a, b) => a + b, 0);
    const rate = Math.min(5, 0.35 + 0.7 * Math.log10(1 + tot));
    R.spawnAcc += dt * rate; R.pendingVis += cps * dt;
    if (R.spawnAcc >= 1) { R.spawnAcc -= 1; stage.spawn({ value: R.pendingVis }); R.pendingVis = 0; }
  }
  // wind-up key
  const wr = E.windupRate(S);
  if (wr) { R.windAcc += dt * wr; while (R.windAcc >= 1) { R.windAcc--; if (visual) doTap(0, 0, true); else E.earn(S, tapVal()); } }
  // timers
  R.frenzyT = Math.max(0, R.frenzyT - dt); R.turboT = Math.max(0, R.turboT - dt); R.stormT = Math.max(0, R.stormT - dt);
  if (S.up.lever && R.turboT <= 0) R.lever = Math.min(150, R.lever + 0.5 * dt);
  const sinceTap = performance.now() - R.lastTap;
  if (sinceTap > 1100 + 300 * E.treeLvl(S, 'combo')) R.combo = Math.max(1, R.combo - dt * 2.5);
  if (E.goldenUnlocked(S)) { R.goldenCd -= dt; if (R.goldenCd <= 0) { R.goldenCd = E.goldenInterval(S) * (0.6 + 0.8 * Math.random()); if (visual) spawnGolden(); else catchGoldenSim(); } }
  R.achT += dt; if (R.achT > 0.5) { R.achT = 0; checkAch(); }
}
function catchGoldenSim() { R.frenzyT = E.frenzyDur(S); S.stats.golden++; }

// ---------- UI: tabs & lists ----------
const iconCache = {};
function gadgetIcon(id, color, extra) {
  const key = id + color + (extra || '');
  if (!iconCache[key]) {
    const c = document.createElement('canvas'); c.width = c.height = 100; const k = c.getContext('2d');
    if (id === 'tap') { k.fillStyle = '#6c4e36'; k.beginPath(); k.ellipse(50, 62, 34, 26, 0, 0, Math.PI * 2); k.fill(); k.fillStyle = '#b23a31'; k.beginPath(); k.ellipse(50, 54, 28, 20, 0, 0, Math.PI * 2); k.fill(); k.fillStyle = '#e8574b'; k.beginPath(); k.ellipse(50, 46, 28, 20, 0, 0, Math.PI * 2); k.fill(); k.fillStyle = 'rgba(255,255,255,.6)'; k.beginPath(); k.ellipse(40, 40, 8, 4, -.4, 0, 7); k.fill(); }
    else if (id === 'unlock') { drawGadget(k, 'polish', 50, 50, 80, 0, color); }
    else drawGadget(k, id, 50, 50, 72, 0.9, color);
    iconCache[key] = c.toDataURL();
  }
  const img = new Image(); img.src = iconCache[key]; img.width = img.height = 50; img.alt = ''; return img;
}
function setTab(t) {
  R.tab = t; R.sig = ''; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('buyMode').hidden = t !== 'gadgets'; $('list').scrollTop = 0;
  if (t === 'trophies') R.newAch = 0;
  renderList();
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { unlockAudio(); sfx('tab'); setTab(b.dataset.tab); }));
document.querySelectorAll('#buyMode button').forEach(b => b.addEventListener('click', () => {
  R.buyN = b.dataset.n === 'max' ? 'max' : +b.dataset.n; document.querySelectorAll('#buyMode button').forEach(q => q.classList.toggle('on', q === b)); sfx('tab'); renderList(true);
}));

function availableUpgrades() { return E.UPGRADES.filter(u => !S.up[u.id] && u.req(S)).sort((a, b) => a.cost - b.cost); }
function listSig() {
  if (R.tab === 'gadgets') return 'g' + E.PRODUCERS.map((_, i) => E.producerVisible(S, i) ? 1 : 0).join('');
  if (R.tab === 'upgrades') return 'u' + availableUpgrades().map(u => u.id).join(',');
  if (R.tab === 'gears') return 'r' + S.gears + JSON.stringify(S.tree) + (E.prestigeGain(S) >= minGain());
  return 't' + S.achCount;
}
let refreshPending = false;
function refreshSoon() { if (!refreshPending) { refreshPending = true; requestAnimationFrame(() => { refreshPending = false; renderList(); updateUI(); }); } }
function renderList(force) {
  const sig = listSig(); if (!force && sig === R.sig) { updateList(); return; } R.sig = sig;
  const L = $('list'), st = L.scrollTop; L.innerHTML = '';
  if (R.tab === 'gadgets') {
    let shownLocked = false;
    E.PRODUCERS.forEach((p, i) => {
      if (!E.producerVisible(S, i)) {
        if (shownLocked) return; shownLocked = true;
        const d = document.createElement('div'); d.className = 'item locked';
        d.innerHTML = `<div class="ico"></div><div><div class="nm">??? Mystery gadget</div><div class="ds">Appears when you've earned ${fmt(p.cost * 0.6)} this build.</div></div><div></div>`;
        d.querySelector('.ico').appendChild(gadgetIcon(p.id, '#b8a68a')); L.appendChild(d); return;
      }
      const d = document.createElement('div'); d.className = 'item' + (R.seen.has('p' + i) ? '' : ' new'); R.seen.add('p' + i); d.dataset.p = i;
      d.innerHTML = `<div class="ico"><span class="own"></span></div><div><div class="nm">${p.name}</div><div class="ds"></div><div class="ms"><i></i></div></div><button class="buy"></button>`;
      d.querySelector('.ico').prepend(gadgetIcon(p.id, p.color));
      d.querySelector('.buy').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); buyProducer(i, e.currentTarget); });
      L.appendChild(d);
    });
  } else if (R.tab === 'upgrades') {
    const ups = availableUpgrades();
    if (!ups.length) L.innerHTML = `<div class="empty">No upgrades right now — keep clacking! New ones appear as your machine grows.</div>`;
    ups.forEach(u => {
      const d = document.createElement('div'); d.className = 'item' + (R.seen.has(u.id) ? '' : ' new'); R.seen.add(u.id); d.dataset.u = u.id;
      d.innerHTML = `<div class="ico"></div><div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div></div><button class="buy ${u.kind === 'unlock' ? 'gold' : ''}"></button>`;
      const ic = u.kind === 'prod' ? gadgetIcon(E.PRODUCERS[u.prod].id, E.PRODUCERS[u.prod].color) : gadgetIcon(u.kind === 'unlock' ? 'unlock' : 'tap', '#f5c542');
      d.querySelector('.ico').appendChild(ic);
      d.querySelector('.buy').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); buyUpgrade(u, e.currentTarget); });
      L.appendChild(d);
    });
    const bought = E.UPGRADES.filter(u => S.up[u.id]).length;
    const f = document.createElement('div'); f.className = 'sec'; f.textContent = `${bought} / ${E.UPGRADES.length} UPGRADES OWNED`; L.appendChild(f);
  } else if (R.tab === 'gears') {
    const gain = E.prestigeGain(S), can = gain >= minGain();
    const next = E.lifetimeForGears(E.gearsFor(S.lifetime) + 1), prev = E.lifetimeForGears(E.gearsFor(S.lifetime));
    const panel = document.createElement('div'); panel.className = 'rebuild';
    panel.innerHTML = `<div class="sec" style="margin:0">REBUILD THE MACHINE</div><div class="big" id="rbGain">+${gain} ⚙</div>
      <p>Each gear ever earned = <b>+10% sparkles forever</b>. Now: <b>×${(1 + E.GEAR_BONUS * S.gearsTotal).toFixed(1)}</b>${S.gearsTotal ? '' : ''}.<br>Gadgets & sparkles reset; gears, tree & trophies stay.</p>
      <div class="ms" style="height:8px;border-radius:4px;background:#efe5d1;overflow:hidden;margin:0 10px 10px"><i id="rbBar" style="display:block;height:100%;background:var(--mustard)"></i></div>
      <button class="buy ${can ? 'red' : 'no'}" id="rbBtn">${can ? 'Rebuild for +' + gain + ' ⚙' : (S.stats.prestiges ? 'Need 1 gear' : 'Need ' + minGain() + ' gears')}</button>`;
    panel.querySelector('#rbBtn').addEventListener('click', () => {
      if (E.prestigeGain(S) < minGain()) { sfx('no'); return; }
      R.modalAct = a => { if (a === 'yes') rebuild(); };
      showModal(`<h2>Rebuild?</h2><p>Fold up this machine and build a bigger one.</p><div class="amt">+${E.prestigeGain(S)} ⚙</div><p>You keep gears, the Gear Tree and trophies.</p>
        <div class="row"><button class="buy no" data-close>Not yet</button><button class="buy red" data-act="yes">Rebuild!</button></div>`);
    });
    L.appendChild(panel);
    const h = document.createElement('div'); h.className = 'sec'; h.innerHTML = `GEAR TREE · <span id="gearsLeft">${S.gears}</span> ⚙ TO SPEND`; L.appendChild(h);
    const tree = document.createElement('div'); tree.className = 'tree';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tree.appendChild(svg);
    const nodes = {};
    for (const n of E.TREE) {
      const l = E.treeLvl(S, n.id), open = n.req.every(r => E.treeLvl(S, r) > 0), maxed = l >= n.max, cost = maxed ? 0 : E.treeCost(n, l);
      const d = document.createElement('div'); d.className = 'node' + (open ? '' : ' locked') + (maxed ? ' maxed' : '');
      d.style.gridColumn = String(n.x + 2); d.style.gridRow = String(n.y + 1);
      const dots = n.max <= 5 ? `<div class="lv">${Array.from({ length: n.max }, (_, k) => `<i class="${k < l ? 'on' : ''}"></i>`).join('')}</div>` : `<div class="lv">Lv ${l}</div>`;
      d.innerHTML = `<b>${n.name}</b>${dots}<div>${n.desc(maxed ? l : l + 1)}</div><button class="buy ${!maxed && open && S.gears >= cost ? 'gold' : 'no'}">${maxed ? 'MAX' : cost + ' ⚙'}</button>`;
      d.querySelector('button').addEventListener('click', () => buyTree(n));
      tree.appendChild(d); nodes[n.id] = d;
    }
    L.appendChild(tree);
    requestAnimationFrame(() => { // connectors
      const tr = tree.getBoundingClientRect(); let html = '';
      for (const n of E.TREE) for (const r of n.req) { const a = nodes[r].getBoundingClientRect(), b = nodes[n.id].getBoundingClientRect();
        html += `<line x1="${a.left + a.width / 2 - tr.left}" y1="${a.bottom - tr.top}" x2="${b.left + b.width / 2 - tr.left}" y2="${b.top - tr.top}" stroke="${E.treeLvl(S, r) ? '#c99a1f' : '#d8ccb6'}" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round"/>`; }
      svg.innerHTML = html;
    });
  } else {
    const g = document.createElement('div'); g.className = 'trophies';
    for (const a of E.ACHIEVEMENTS) { const got = !!S.ach[a.id]; const d = document.createElement('div'); d.className = 'tro' + (got ? '' : ' lock'); d.innerHTML = `<div class="medal">${got ? '★' : '?'}</div><b>${got ? a.name : '???'}</b>${a.desc}`; g.appendChild(d); }
    const h = document.createElement('div'); h.className = 'sec'; h.textContent = `${S.achCount} / ${E.ACHIEVEMENTS.length} TROPHIES · +${S.achCount * 2}% SPARKLES`;
    L.appendChild(h); L.appendChild(g);
    const st2 = document.createElement('div'); st2.className = 'empty';
    st2.innerHTML = `Taps: ${fmt(S.stats.taps)} · Golden caught: ${S.stats.golden} · Rebuilds: ${S.stats.prestiges}<br>Played: ${E.fmtTime(S.stats.playTime)} · Total sparkles: ${fmt(S.lifetime)}<br><br><button class="buy no" id="wipe" style="font-size:12px">Erase save…</button>`;
    L.appendChild(st2);
    st2.querySelector('#wipe').addEventListener('click', () => {
      R.modalAct = a => { if (a === 'wipe') { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.bak'); S = E.newState(); R.disp = 0; stage.marbles = []; stage.jar = []; stage.setOwned(S.owned); setTab('gadgets'); } };
      showModal(`<h2>Erase everything?</h2><p>This deletes all progress, gears and trophies. It can't be undone.</p><div class="row"><button class="buy" data-close>Keep it</button><button class="buy red" data-act="wipe">Erase</button></div>`);
    });
  }
  L.scrollTop = st; updateList();
}
function updateList() {
  const L = $('list');
  if (R.tab === 'gadgets') {
    L.querySelectorAll('.item[data-p]').forEach(d => {
      const i = +d.dataset.p, p = E.PRODUCERS[i], n = buyCount(i), cost = E.producerCost(S, i, n), can = S.bank >= cost;
      const each = p.rate * E.prodMult(S, i) * E.globalMult(S) * boostMult();
      d.querySelector('.own').textContent = S.owned[i] || '';
      const nm = E.nextMilestone(S.owned[i]);
      d.querySelector('.ds').textContent = S.owned[i] ? `+${fmt(each, 1)}/s each · ${nm ? `×2 at ${nm}` : 'maxed!'}` : p.desc;
      const prevM = [0, ...E.MILESTONES].filter(t => t <= S.owned[i]).pop();
      d.querySelector('.ms i').style.width = nm ? ((S.owned[i] - prevM) / (nm - prevM) * 100) + '%' : '100%';
      const b = d.querySelector('.buy'); b.className = 'buy' + (can ? '' : ' no'); b.innerHTML = `${fmt(cost)}<small>BUY ×${n}</small>`;
      d.classList.toggle('can', can);
    });
  } else if (R.tab === 'upgrades') {
    L.querySelectorAll('.item[data-u]').forEach(d => {
      const u = E.UPG_BY_ID[d.dataset.u], cost = E.upgCost(S, u), can = S.bank >= cost;
      const b = d.querySelector('.buy'); b.className = 'buy' + (can ? (u.kind === 'unlock' ? ' gold' : '') : ' no'); b.innerHTML = `${fmt(cost)}<small>${u.kind === 'unlock' ? 'UNLOCK' : 'BUY'}</small>`;
      d.classList.toggle('can', can);
    });
  } else if (R.tab === 'gears') {
    const gain = E.prestigeGain(S), g = $('rbGain'); if (g) g.textContent = '+' + gain + ' ⚙';
    const bar = $('rbBar'); if (bar) { const a = E.lifetimeForGears(E.gearsFor(S.lifetime)), b = E.lifetimeForGears(E.gearsFor(S.lifetime) + 1); bar.style.width = Math.max(0, Math.min(100, (S.lifetime - a) / (b - a) * 100)) + '%'; }
    const btn = $('rbBtn'); if (btn) { const can = gain >= minGain(); btn.className = 'buy ' + (can ? 'red' : 'no'); btn.textContent = can ? `Rebuild for +${gain} ⚙` : `Next gear at ${fmt(E.lifetimeForGears(E.gearsFor(S.lifetime) + 1))} total`; }
  }
}

// ---------- per-frame HUD ----------
function nextGoal() {
  let best = null;
  E.PRODUCERS.forEach((p, i) => { if (E.producerVisible(S, i)) { const c = E.producerCost(S, i); if (!best || c < best.cost) best = { cost: c, name: p.name, tab: 'gadgets' }; } });
  for (const u of availableUpgrades()) { const c = E.upgCost(S, u); if (!best || c < best.cost) best = { cost: c, name: u.name, tab: 'upgrades' }; }
  return best;
}
function updateUI() {
  // bank roll-up
  if (S.bank < R.disp) R.disp = S.bank; else R.disp += (S.bank - R.disp) * 0.25;
  const txt = fmt(R.disp); const be = $('bank'); if (be.textContent !== txt) be.textContent = txt;
  $('cps').textContent = `${fmt(cpsNow(), 1)} / sec${boostMult() > 1 ? '  ×' + boostMult() + '!' : ''}`;
  // combo
  const cm = E.comboMax(S), f = (R.combo - 1) / (cm - 1);
  $('comboArc').style.strokeDashoffset = 339.3 * (1 - f);
  $('comboArc').style.stroke = f >= 1 ? '#e8574b' : '#f5c542';
  const cl = $('comboLbl'); cl.textContent = `×${R.combo.toFixed(1)} COMBO`; cl.classList.toggle('on', R.combo > 1.05); cl.classList.toggle('hot', f >= 1);
  // lever
  const lb = $('leverBox'); lb.hidden = !S.up.lever;
  if (S.up.lever) { $('leverFill').style.width = (R.turboT > 0 ? R.turboT / 15 * 100 : R.lever / 150 * 100) + '%'; lb.classList.toggle('ready', R.lever >= 150 && R.turboT <= 0); lb.classList.toggle('active', R.turboT > 0); }
  // next goal
  const g = nextGoal();
  if (g) { const can = S.bank >= g.cost; $('nextName').textContent = g.name; $('nextBar').style.width = Math.min(100, S.bank / g.cost * 100) + '%';
    $('nextBar').style.background = can ? 'var(--red)' : 'var(--teal)'; const inc = incomeEstimate();
    $('nextEta').textContent = can ? 'Ready — buy it!' : `${fmt(g.cost)} · ~${E.fmtTime((g.cost - S.bank) / Math.max(inc, 0.1))}`; R.nextTab = g.tab; }
  // tabs visibility + dots
  const showGears = S.gearsTotal > 0 || S.lifetime >= 1e8; $('gearsTab').hidden = !showGears;
  document.querySelector('[data-tab=trophies]').hidden = S.achCount === 0;
  $('tabs').classList.toggle('four', showGears && S.achCount > 0);
  $('gearChip').hidden = S.gearsTotal <= 0; $('gearCount').textContent = S.gears;
  const nP = E.PRODUCERS.filter((_, i) => E.producerVisible(S, i) && S.bank >= E.producerCost(S, i)).length;
  const nU = availableUpgrades().filter(u => S.bank >= E.upgCost(S, u)).length;
  const nG = (E.prestigeGain(S) >= minGain() ? 1 : 0) + E.TREE.filter(n => E.treeLvl(S, n.id) < n.max && n.req.every(r => E.treeLvl(S, r) > 0) && S.gears >= E.treeCost(n, E.treeLvl(S, n.id))).length;
  setDot('gadgets', nP); setDot('upgrades', nU); setDot('gears', nG); setDot('trophies', R.newAch || 0);
  // buffs
  const buffs = [['frenzy', R.frenzyT, E.frenzyDur(S), `FRENZY ×${E.frenzyMult(S)}`], ['turbo', R.turboT, 15, 'TURBO ×3'], ['storm', R.stormT, 12, 'TAP STORM ×25']];
  const bx = $('buffs');
  for (const [id, t, max, label] of buffs) { let el = bx.querySelector('.' + id); if (t > 0) { if (!el) { el = document.createElement('div'); el.className = 'buff ' + id; el.innerHTML = `${label} <span></span><i></i>`; bx.appendChild(el); } el.querySelector('span').textContent = Math.ceil(t) + 's'; el.querySelector('i').style.width = (t / max * 100) + '%'; } else if (el) el.remove(); }
  stage.boost = (R.frenzyT > 0 || R.turboT > 0) ? 1 : 0;
}
function setDot(tab, n) { const d = document.querySelector(`[data-tab=${tab}] .dot`); if (!d) return; d.hidden = !n; if (n && d.textContent !== String(n)) d.textContent = n > 9 ? '9+' : n; }

// ---------- input ----------
$('press').addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); doTap(e.clientX, e.clientY); });
$('cv').addEventListener('pointerdown', e => {
  e.preventDefault(); unlockAudio();
  const r = $('cv').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const g = stage.hitGolden(x, y); if (g) catchGolden(g, e.clientX, e.clientY); else doTap(e.clientX, e.clientY);
});
$('lever').addEventListener('pointerdown', e => {
  e.preventDefault(); unlockAudio();
  if (R.lever >= 150 && R.turboT <= 0) { R.turboT = 15; R.lever = 0; S.stats.levers++; banner('TURBO!', '×3 everything for 15s'); sfx('lever'); bigShake(); buzz([20, 20, 80]); stage.shake(6); }
  else { sfx('no'); buzz(5); pop(e.clientX, e.clientY - 20, R.turboT > 0 ? 'Whoosh!' : 'Keep tapping!', 'sm'); }
});
$('nextBox').addEventListener('click', () => { if (R.nextTab) setTab(R.nextTab); });
$('muteBtn').addEventListener('click', () => { S.muted = !S.muted; setMuted(S.muted); $('muteBtn').classList.toggle('off', S.muted); unlockAudio(); sfx('tab'); save(); });
$('muteBtn').classList.toggle('off', S.muted);

// stage callbacks
stage.onLand = m => {
  sfx('land');
  if (m.value > 0 && R.popBudget > 0) { R.popBudget--; const [x, y] = stage.toScreen(m.x, m.y - 14); pop(x, y, '+' + fmt(m.value, 1), 'sm'); }
  if (m.golden && !R.hintGold) { R.hintGold = true; const [x, y] = stage.toScreen(m.x, m.y - 30); pop(x, y, 'Tap the gold one!', 'mid gold'); }
};
stage.onClack = () => sfx('clack');
stage.onGadget = (id) => { if (id === 'bell') sfx('ding'); else if (id === 'spring') sfx('boing'); };
stage.onJarFull = () => {
  const bonus = Math.max(10, 5 * incomeEstimate()); E.earn(S, bonus);
  const [x, y] = jarScreen(); pop(x, y - 20, 'JAR FULL! +' + fmt(bonus), 'mid gold'); sfx('jar'); buzz(20); stage.burst(stage.jarBox.x + stage.jarBox.w / 2, stage.jarBox.y, 'confetti', 30);
};

// ---------- main loop ----------
let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  logic(dt);
  R.popBudget = Math.min(4, R.popBudget + dt * 3);
  // springy press button
  R.pv += (-320 * R.py - 16 * R.pv) * dt; R.py += R.pv * dt;
  const cap = document.querySelector('#press .cap'); cap.style.setProperty('--py', R.py.toFixed(2) + 'px'); cap.style.setProperty('--ps', (1 + R.py * 0.006).toFixed(3));
  stage.update(dt); stage.draw();
  R.uiT += dt; if (R.uiT > 0.1) { R.uiT = 0; updateUI(); renderList(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { offlineCheck(); last = performance.now(); } });
addEventListener('pagehide', save);

// ---------- boot ----------
offlineCheck();
setTab('gadgets'); updateUI();
requestAnimationFrame(frame);
if (S.stats.taps === 0 && S.lifetime === 0) setTimeout(() => banner('Tap PRESS!', 'Drop marbles, collect sparkles'), 600);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

// automation / debugging hook (used by test/play.mjs)
window.CW = {
  get S() { return S; }, E, R, stage,
  advance(sec) { for (let t = 0; t < sec; t += 0.1) logic(0.1, false); refreshSoon(); },
  tap(n = 1) { const r = $('press').getBoundingClientRect(); for (let i = 0; i < n; i++) doTap(r.left + r.width / 2, r.top, false); },
  rebuild, save, spawnGolden, setTab,
};
