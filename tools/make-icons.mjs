// Renders the app icons in headless Chrome (everything drawn in code). node tools/make-icons.mjs
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:8765/index.html');
for (const [size, mask, file] of [[192, false, 'icon-192.png'], [512, false, 'icon-512.png'], [512, true, 'icon-maskable-512.png']]) {
  const data = await page.evaluate((size, mask) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const k = c.getContext('2d'); const s = size / 512;
    k.scale(s, s);
    k.fillStyle = '#e9dcc3'; if (mask) k.fillRect(0, 0, 512, 512); else { k.beginPath(); k.roundRect(0, 0, 512, 512, 110); k.fill(); }
    const sc = mask ? 0.78 : 1; k.translate(256, 256); k.scale(sc, sc); k.translate(-256, -256);
    // ramp strips
    const strip = (y, col, dir) => { k.save(); k.translate(256, y); k.rotate(dir * 0.12); k.fillStyle = 'rgba(70,40,15,.22)'; k.fillRect(-190, 6, 380, 34); k.fillStyle = col; k.fillRect(-190, 0, 380, 34); k.restore(); };
    strip(110, '#4fa3e0', 1); strip(190, '#f5c542', -1);
    // button
    k.fillStyle = 'rgba(70,40,15,.25)'; k.beginPath(); k.ellipse(262, 400, 150, 70, 0, 0, 7); k.fill();
    k.fillStyle = '#6c4e36'; k.beginPath(); k.ellipse(256, 380, 150, 72, 0, 0, 7); k.fill();
    k.fillStyle = '#b23a31'; k.beginPath(); k.ellipse(256, 350, 122, 58, 0, 0, 7); k.fill(); k.fillRect(134, 310, 244, 40);
    k.fillStyle = '#e8574b'; k.beginPath(); k.ellipse(256, 310, 122, 58, 0, 0, 7); k.fill();
    k.fillStyle = 'rgba(255,255,255,.55)'; k.beginPath(); k.ellipse(210, 292, 40, 16, -0.3, 0, 7); k.fill();
    // marbles
    const marble = (x, y, r, col) => { k.fillStyle = 'rgba(70,40,15,.25)'; k.beginPath(); k.arc(x + 4, y + 8, r, 0, 7); k.fill(); k.fillStyle = col; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); k.fillStyle = 'rgba(255,255,255,.8)'; k.beginPath(); k.ellipse(x - r * .35, y - r * .4, r * .3, r * .18, -0.6, 0, 7); k.fill(); };
    marble(150, 80, 34, '#3fb6a8'); marble(360, 160, 34, '#ef7fb0'); marble(256, 225, 40, '#ffd23f');
    return c.toDataURL('image/png').split(',')[1];
  }, size, mask);
  writeFileSync(new URL('../icons/' + file, import.meta.url), Buffer.from(data, 'base64'));
}
await browser.close(); console.log('icons done');
