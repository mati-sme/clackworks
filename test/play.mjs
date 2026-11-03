// Headless smoke/auto-play test at phone size. Needs a local server on :8765 (python3 -m http.server 8765)
// and puppeteer-core (npm i). Usage: node test/play.mjs
import puppeteer from 'puppeteer-core';
const URL_ = process.env.URL || 'http://localhost:8765/';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
const log = (...a) => console.log('[play]', ...a);

await page.goto(URL_); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(700);
const box = await (await page.$('#press')).boundingBox();
const press = async (n, gap = 70) => { for (let i = 0; i < n; i++) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await sleep(gap); } };
// real-input helper: tap the first affordable buy button in the open list (scrolls it into view first)
const buyFirst = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('#list .item .buy')].reverse().find(b => !b.classList.contains('no'));
  if (!b) return false; b.scrollIntoView({ block: 'nearest' }); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); return true;
});
const state = () => page.evaluate(() => ({ bank: CW.S.bank, cps: CW.E.baseCps ? 0 : 0, owned: CW.S.owned.reduce((a, b) => a + b, 0), ups: Object.keys(CW.S.up).length, gain: CW.E.prestigeGain(CW.S), gears: CW.S.gearsTotal, life: CW.S.lifetime }));

// 1) first seconds: real taps, buy first funnel
await press(30);
await page.evaluate(() => CW.setTab('gadgets'));
let bought = 0; while (await buyFirst()) { bought++; await sleep(40); if (bought > 20) break; }
log('first buys', bought, await state());
await press(25, 60); await sleep(1500);
await page.screenshot({ path: SHOTS + '01-first-minute.png' });

// 2) auto-play ~simulated minutes: alternate advance, taps, buying from both shops
let simSec = 0, buys = bought;
for (let round = 0; round < 400 && (await state()).gain < 5; round++) {
  await page.evaluate(() => { CW.advance(8); CW.tap(16); });
  simSec += 8;
  for (const tab of ['upgrades', 'gadgets']) { await page.evaluate(t => CW.setTab(t), tab); let k = 0; while (k < 12 && await buyFirst()) { k++; buys++; } }
  if (round % 25 === 0) log(`t=${Math.round(simSec / 60)}m`, JSON.stringify(await state()));
}
log('ready to rebuild after', (simSec / 60).toFixed(1), 'sim minutes,', buys, 'buys', JSON.stringify(await state()));
await page.evaluate(() => CW.setTab('gadgets')); await sleep(2500);
// golden marble: spawn and catch it with a real tap on the canvas
await page.evaluate(() => CW.spawnGolden());
let caught = false;
for (let i = 0; i < 60 && !caught; i++) {
  await sleep(100);
  const pos = await page.evaluate(() => { const g = [...CW.stage.marbles, ...CW.stage.jar].find(m => m.golden && !m.caught); if (!g) return null; return CW.stage.toScreen(g.x, g.y); });
  if (pos && i > 8) { await page.touchscreen.tap(pos[0], pos[1]); await sleep(50); caught = await page.evaluate(() => CW.S.stats.golden > 0); }
}
log('golden caught:', caught);
await sleep(700);
await page.screenshot({ path: SHOTS + '02-machine-golden.png' });

// 3) rebuild through the UI
await page.evaluate(() => CW.setTab('gears')); await sleep(300);
await page.tap('#rbBtn'); await sleep(400);
await page.tap('#modalCard button[data-act="yes"]'); await sleep(1800);
const after = await state(); log('after rebuild', JSON.stringify(after));
if (after.gears < 5) errors.push('rebuild did not award gears');
await page.tap('#modalCard button.gold'); await sleep(400);
await page.evaluate(() => CW.setTab('gears')); await sleep(300);
const treeBuy = await page.evaluate(() => { const b = [...document.querySelectorAll('#list .node .buy.gold')][0]; if (!b) return null; const name = b.parentElement.querySelector('b').textContent; b.click(); return name; });
log('bought tree node:', treeBuy); if (!treeBuy) errors.push('no affordable tree node after rebuild');
await sleep(500);
await page.evaluate(() => document.querySelector('#list .tree').scrollIntoView({ block: 'start' }));
await page.screenshot({ path: SHOTS + '03-gear-tree.png' });

// 4) save/reload + offline earnings
await page.evaluate(() => CW.save());
await page.goto(URL_ + 'manifest.webmanifest'); // leave the game (it saves on pagehide), then age the save by 1h
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('clackworks.save')); s.lastSeen -= 3600e3; localStorage.setItem('clackworks.save', JSON.stringify(s)); });
await page.goto(URL_); await sleep(1200);
const modal = await page.evaluate(() => !document.querySelector('#modal').hidden && document.querySelector('#modalCard').innerText);
log('offline modal:', JSON.stringify(modal));
await page.screenshot({ path: SHOTS + '04-welcome-back.png' });
const kept = await page.evaluate(() => CW.S.gearsTotal); if (kept < 5) errors.push('save did not persist gears');

await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('[play] PASS: no console errors');
