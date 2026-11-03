// Clackworks v2 headless test. Needs a local server on :8765 (python3 -m http.server 8765) and puppeteer-core.
// Usage: node test/play.mjs   (CHROME=/path/to/chrome URL=http://... optional)
import puppeteer from 'puppeteer-core';
const URL_ = process.env.URL || 'http://localhost:8765/';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS ' : '  FAIL ') + msg); if (!cond) fails++; };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function open(w, h, save) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.errors = [];
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('pageerror', e => p.errors.push(e.message));
  // seed storage before any game script runs (a reload would let the old page re-save on pagehide)
  await p.evaluateOnNewDocument(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); if (s) localStorage.setItem('clackworks.save', JSON.stringify(s)); } }, save || null);
  await p.goto(URL_ + '?t=' + Date.now(), { waitUntil: 'networkidle0' });
  await sleep(600);
  p.cdp = await p.createCDPSession();
  return p;
}
// real multi-finger touch through CDP (fires pointer events with distinct pointerIds)
async function touch(p, type, pts) { await p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) }); }
async function tap(p, pts) { await touch(p, 'touchStart', pts); await touch(p, 'touchEnd', []); }
const center = (p, sel) => p.evaluate(s => { const el = typeof s === 'string' ? document.querySelector(s) : null; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const tileXY = (p, k) => p.evaluate(k => { const r = CW.tiles[k].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, k);
async function layoutCheck(p, label) {
  const L = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('#top, #stage, #dock, #grid .tile:not([hidden]), #boostRow > :not([hidden]), #shopTabs')];
    const out = vis.filter(el => { const r = el.getBoundingClientRect(); return r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1; }).map(el => el.id || el.className);
    window.scrollTo(0, 500);
    return { sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth, out, sy: scrollY, stageH: document.getElementById('stage').getBoundingClientRect().height };
  });
  ok(L.sh <= L.ih && L.sw <= L.iw, `${label}: no scroll (scrollHeight ${L.sh} <= innerHeight ${L.ih}, width ${L.sw} <= ${L.iw})`);
  ok(L.sy === 0, `${label}: page cannot be scrolled (scrollY after scrollTo = ${L.sy})`);
  ok(L.out.length === 0, `${label}: every control inside the viewport ${L.out.length ? JSON.stringify(L.out) : ''}`);
  ok(L.stageH >= 150, `${label}: machine stage visible (${Math.round(L.stageH)}px tall)`);
}
async function panelFits(p, label) {
  const f = await p.evaluate(() => { const c = document.querySelector('.pcard'); const r = c.getBoundingClientRect(); return { sh: c.scrollHeight, ch: c.clientHeight, b: r.bottom, ih: innerHeight }; });
  ok(f.sh <= f.ch + 1 && f.b <= f.ih + 1, `${label}: panel fits without scrolling (${f.sh} <= ${f.ch})`);
}

// ---------- 1. fresh start on each phone size ----------
for (const [w, h] of [[390, 844], [375, 667], [360, 740]]) {
  console.log(`\n== ${w}x${h} fresh start`);
  const p = await open(w, h);
  const s0 = await p.evaluate(() => CW.S.runEarned);
  await sleep(2500);
  const s1 = await p.evaluate(() => ({ e: CW.S.runEarned, m: CW.stage.marbles.length, press: !!document.getElementById('press') }));
  ok(!s1.press, 'no PRESS button');
  ok(s1.e > s0 && s1.m > 0, `machine runs by itself (earned ${s1.e.toFixed(1)}, ${s1.m} marbles on track, no input)`);
  await layoutCheck(p, `${w}x${h}`);
  await p.screenshot({ path: `${SHOTS}v2-${w}x${h}-start.png` });
  // mid-game layout: lots unlocked
  await p.evaluate(() => { const S = CW.S; S.owned = [40, 30, 25, 20, 12, 6, 2, 0, 0, 0, 0, 0]; for (const id of ['golden', 'lever', 'auto', 'bigjar', 'popper']) S.up[id] = true; S.runEarned = S.lifetime = 2e9; S.bank = 5e6; S.achCount = 3; S.ach = { tap0: 1, combo0: 1, own0: 1 }; CW.stage.setOwned(S.owned); CW.computeBest(); CW.R.lever = CW.E.LEVER_FULL; });
  await sleep(900);
  await layoutCheck(p, `${w}x${h} mid-game`);
  await p.screenshot({ path: `${SHOTS}v2-${w}x${h}-midgame.png` });
  await tap(p, [await center(p, '[data-tab=upgrades]')]); await sleep(400);
  await layoutCheck(p, `${w}x${h} upgrades tab`);
  if (w === 390) await p.screenshot({ path: `${SHOTS}v2-${w}x${h}-upgrades.png` });
  await tap(p, [await center(p, '#gearChip')]); await sleep(500);
  await panelFits(p, `${w}x${h} rebuild panel`);
  if (w !== 360) await p.screenshot({ path: `${SHOTS}v2-${w}x${h}-rebuild-panel.png` });
  await p.evaluate(() => CW.closePanel());
  await tap(p, [await center(p, '#trophyBtn')]); await sleep(400);
  await panelFits(p, `${w}x${h} trophies panel`);
  if (w === 390) await p.screenshot({ path: `${SHOTS}v2-${w}x${h}-trophies.png` });
  ok(p.errors.length === 0, `no console errors ${p.errors.join(' | ')}`);
  await p.close();
}

// ---------- 2. multi-touch + hold-to-buy (390x844) ----------
console.log('\n== multi-touch & hold-to-buy');
{
  const p = await open(390, 844);
  await p.evaluate(() => { CW.S.owned[0] = 1; CW.S.bank = 1e6; CW.S.runEarned = 400; CW.stage.setOwned(CW.S.owned); CW.computeBest(); });
  await sleep(300);
  // two fingers on two different tiles at the same instant
  const before = await p.evaluate(() => CW.S.owned.slice(0, 2));
  await tap(p, [await tileXY(p, 0), await tileXY(p, 1)]);
  const after = await p.evaluate(() => CW.S.owned.slice(0, 2));
  ok(after[0] === before[0] + 1 && after[1] === before[1] + 1, `two-finger tap bought both gadgets (${before} -> ${after})`);
  // rapid tapping: 12 taps 25ms apart, every one counts
  let b = await p.evaluate(() => CW.S.owned[0]);
  const t0 = await tileXY(p, 0);
  for (let i = 0; i < 12; i++) { await tap(p, [t0]); await sleep(25); }
  let a = await p.evaluate(() => CW.S.owned[0]);
  ok(a - b === 12, `12 rapid taps = 12 buys (got ${a - b})`);
  // two fingers holding two different tiles: both repeat-buy at the same time
  b = await p.evaluate(() => CW.S.owned.slice(0, 2));
  const t1 = await tileXY(p, 1);
  await touch(p, 'touchStart', [t0]); await sleep(900);
  await touch(p, 'touchStart', [t0, t1]); await sleep(1100);
  await touch(p, 'touchEnd', []);
  a = await p.evaluate(() => CW.S.owned.slice(0, 2));
  ok(a[0] - b[0] >= 10 && a[1] - b[1] >= 4, `two simultaneous holds both repeat (tile0 +${a[0] - b[0]}, tile1 +${a[1] - b[1]})`);
  // press and hold = repeat buying, accelerating
  b = await p.evaluate(() => CW.S.owned[2]);
  const t2 = await tileXY(p, 2);
  await touch(p, 'touchStart', [t2]); await sleep(2000); await touch(p, 'touchEnd', []);
  a = await p.evaluate(() => CW.S.owned[2]);
  await sleep(300);
  const a2 = await p.evaluate(() => CW.S.owned[2]);
  ok(a - b >= 12, `2s hold bought ${a - b} (>= 12)`);
  ok(a2 === a, 'buying stops when the finger lifts');
  // canvas: 3 fingers pop 3 marbles at once
  await sleep(1500);
  const pts = await p.evaluate(() => { const r = CW.stage.cv.getBoundingClientRect(); return CW.stage.marbles.filter(m => !m.golden && m.state !== 'rest' && m.y > 40).slice(0, 3).map(m => [r.left + m.x, r.top + m.y]); });
  const pops0 = await p.evaluate(() => CW.S.stats.pops);
  await tap(p, pts);
  const pops1 = await p.evaluate(() => CW.S.stats.pops);
  ok(pts.length >= 2 && pops1 - pops0 >= Math.min(2, pts.length), `multi-finger marble pops (${pts.length} fingers -> ${pops1 - pops0} pops)`);
  // swipe across the track pops marbles along the way
  // golden marble: tap to catch
  await p.evaluate(() => { CW.S.up.golden = true; CW.spawnGolden(); });
  await sleep(1200);
  const g = await p.evaluate(() => { const r = CW.stage.cv.getBoundingClientRect(); const m = CW.stage.marbles.find(m => m.golden && !m.caught); return m ? [r.left + m.x, r.top + m.y] : null; });
  const gc0 = await p.evaluate(() => CW.S.stats.golden);
  if (g) await tap(p, [g]);
  await sleep(200);
  ok(g && (await p.evaluate(() => CW.S.stats.golden)) === gc0 + 1, 'tapping a golden marble catches it');
  await sleep(600);
  await p.screenshot({ path: `${SHOTS}v2-390x844-golden.png` });
  // swipe on the dock must not scroll the page
  await touch(p, 'touchStart', [[195, 700]]); for (let y = 690; y > 300; y -= 30) { await touch(p, 'touchMove', [[195, y]]); } await touch(p, 'touchEnd', []);
  ok((await p.evaluate(() => scrollY)) === 0, 'swiping on the shop does not scroll the page');
  ok(p.errors.length === 0, `no console errors ${p.errors.join(' | ')}`);
  await p.close();
}

// ---------- 3. autoplay from zero through a rebuild, buying only with real taps ----------
console.log('\n== autoplay through a rebuild (taps the BEST buy, pulls turbo, catches nothing else)');
{
  const p = await open(375, 667);
  const goal = await center(p, '#goal');
  let taps = 0, buys0 = 0;
  for (let step = 0; step < 4000; step++) {
    await p.evaluate(() => CW.advance(4));
    for (let k = 0; k < 4; k++) {
      const can = await p.evaluate(() => CW.R.best && CW.S.bank >= CW.R.best.cost);
      if (!can) break; await tap(p, [goal]); taps++;
    }
    const st = await p.evaluate(() => { const t = document.getElementById('turbo'); return { gain: CW.E.prestigeGain(CW.S), need: CW.E.MIN_PRESTIGE_GAIN, turbo: !t.hidden && t.classList.contains('ready') }; });
    if (st.turbo) await tap(p, [await center(p, '#turbo')]);
    if (st.gain >= st.need) break;
  }
  const pre = await p.evaluate(() => ({ min: CW.S.stats.playTime / 60, buys: CW.S.stats.buys, gain: CW.E.prestigeGain(CW.S), owned: CW.S.owned.reduce((a, b) => a + b, 0), auto: CW.S.up.auto }));
  console.log(`  reached rebuild after ${pre.min.toFixed(1)} sim-min, ${pre.buys} buys (${taps} taps on BEST), ${pre.owned} gadgets, auto-builder ${pre.auto ? 'bought' : 'not bought'}`);
  ok(pre.gain >= 1 && pre.min > 8 && pre.min < 40, `first rebuild reachable in a sensible time (${pre.min.toFixed(1)} min)`);
  await p.screenshot({ path: `${SHOTS}v2-375x667-before-rebuild.png` });
  await tap(p, [await center(p, '#gearChip')]); await sleep(400);
  await tap(p, [await center(p, '#rbBtn')]); await sleep(300);
  await tap(p, [await center(p, '#modal [data-act=yes]')]); await sleep(900);
  const post = await p.evaluate(() => ({ g: CW.S.gears, pr: CW.S.stats.prestiges, owned: CW.S.owned.reduce((a, b) => a + b, 0), bank: CW.S.bank }));
  ok(post.pr === 1 && post.g === pre.gain && post.owned === 0, `rebuild done: +${post.g} gears, gadgets reset`);
  await p.screenshot({ path: `${SHOTS}v2-375x667-rebuilt.png` });
  await tap(p, [await center(p, '#modal [data-close]')]); await sleep(500);
  ok(await p.evaluate(() => !document.getElementById('panel').hidden), 'gear tree opens after rebuild');
  const g0 = await p.evaluate(() => CW.S.gears);
  const nodeBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('.node .buy.gold')][0]; if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (nodeBtn) { await p.mouse.click(...nodeBtn); }
  ok(nodeBtn && (await p.evaluate(() => CW.S.gears)) < g0, 'bought a gear tree node');
  await p.screenshot({ path: `${SHOTS}v2-375x667-gear-tree.png` });
  await p.evaluate(() => CW.closePanel());
  // second run is faster
  const r2 = await p.evaluate(() => { const t0 = CW.S.stats.playTime; let n = 0; while (CW.S.owned[0] < 1 && n < 100) { CW.advance(1); n++; } return CW.S.stats.playTime - t0; });
  const income = await p.evaluate(() => CW.E.baseCps(CW.S));
  ok(income > 0, `after rebuild the machine is running again (${income.toFixed(1)}/s, auto-builder kept)`);
  ok(p.errors.length === 0, `no console errors ${p.errors.join(' | ')}`);
  await p.close();
}

// ---------- 4. Auto-Builder buys by itself ----------
console.log('\n== auto-builder');
{
  const p = await open(390, 844);
  await p.evaluate(() => { CW.S.up.auto = true; CW.S.owned[0] = 3; CW.S.bank = 5000; CW.S.runEarned = 5000; CW.stage.setOwned(CW.S.owned); });
  const b0 = await p.evaluate(() => CW.S.stats.buys);
  await sleep(3500);
  const b1 = await p.evaluate(() => CW.S.stats.buys);
  ok(b1 - b0 >= 2, `auto-builder bought ${b1 - b0} things in 3.5s with no input`);
  await tap(p, [await center(p, '#autoBtn')]);
  const off = await p.evaluate(() => CW.S.autoOn === false);
  ok(off, 'AUTO button toggles it off');
  ok(p.errors.length === 0, `no console errors ${p.errors.join(' | ')}`);
  await p.close();
}

// ---------- 5. v1 save migration + offline earnings ----------
console.log('\n== v1 save migration');
{
  const v1 = { v: 3, bank: 1234, owned: [10, 5, 2], runEarned: 5e4, lifetime: 2e9, gears: 2, gearsTotal: 6, up: { crank0: true, crank1: true, sticky0: true, windup: true, golden: true }, tree: { crank: 2, oil: 1 }, ach: { tap0: 1 }, achCount: 1,
    stats: { taps: 900, golden: 3, playTime: 3000, prestiges: 1, frenzies: 1, levers: 2 }, muted: true, lastSeen: Date.now() - 2 * 3600e3 };
  const p = await open(390, 844, v1);
  await sleep(500);
  const m = await p.evaluate(() => ({ html: document.getElementById('modalCard').innerText, hidden: document.getElementById('modal').hidden, S: { bank: CW.S.bank, gears: CW.S.gears, up: CW.S.up, tree: CW.S.tree, owned: CW.S.owned.slice(0, 3), refund: CW.S.refund, v: CW.S.v } }));
  ok(!m.hidden && /runs itself/i.test(m.html), 'update notice explains the change');
  ok(m.S.gears === 2 + 5 && !m.S.up.crank0 && m.S.up.golden && m.S.owned[0] === 10 && m.S.v === 4 && !m.S.refund, `crank refunded (gears 2 -> ${m.S.gears}, bank ${Math.round(m.S.bank)}), gadgets & golden kept, save v${m.S.v}`);
  await p.screenshot({ path: `${SHOTS}v2-migration.png` });
  await tap(p, [await center(p, '#modal [data-close]')]); await sleep(300);
  const off = await p.evaluate(() => document.getElementById('modalCard').innerText);
  ok(/welcome back/i.test(off), 'offline earnings modal queued after it');
  const bank0 = await p.evaluate(() => CW.S.bank);
  await tap(p, [await center(p, '#collect')]); await sleep(200);
  ok((await p.evaluate(() => CW.S.bank)) > bank0, 'collect adds offline sparkles');
  ok(p.errors.length === 0, `no console errors ${p.errors.join(' | ')}`);
  await p.close();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
