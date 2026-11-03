// Paper-craft marble machine renderer (front-on shadow-box diorama)
const COLORS = ['#e8574b', '#4fa3e0', '#f5c542', '#3fb6a8', '#8e6bd8', '#ef7fb0', '#ff8c42'];
const INK = '#3b2a22';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function shade(hex, f) { // f<0 darker, >0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
// cut-paper fill: soft drop shadow + flat colour
function paper(ctx, fill, build, sh = 1) {
  ctx.save();
  ctx.shadowColor = 'rgba(70,40,15,0.28)'; ctx.shadowBlur = 6 * sh; ctx.shadowOffsetY = 3 * sh; ctx.shadowOffsetX = 1 * sh;
  ctx.fillStyle = fill; ctx.beginPath(); build(ctx); ctx.fill();
  ctx.restore();
}
// cheap fake-shadow version for per-frame drawing
function paperFast(ctx, fill, build, dy = 3) {
  ctx.fillStyle = 'rgba(70,40,15,0.2)'; ctx.save(); ctx.translate(1, dy); ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
  ctx.fillStyle = fill; ctx.beginPath(); build(ctx); ctx.fill();
}
function rrect(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function star(c, x, y, r1, r2, n = 5, rot = -Math.PI / 2) { for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
function cloud(c, x, y, s) { c.arc(x, y, s, Math.PI * .5, Math.PI * 1.5); c.arc(x + s * .9, y - s * .55, s * .85, Math.PI, 0); c.arc(x + s * 1.9, y - s * .1, s * .75, Math.PI * 1.3, Math.PI * .5); c.closePath(); }
function gear(c, x, y, r, teeth, rot) { const n = teeth * 2; for (let i = 0; i <= n * 2; i++) { const a = rot + i / (n * 2) * TAU; const rr = (Math.floor(i / 2) % 2) ? r : r * 0.8; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.moveTo(x + r * .3, y); c.arc(x, y, r * .3, 0, TAU, true); }

// ---- gadget icons (also used in the shop list) ----
export function drawGadget(c, id, x, y, s, t = 0, color = '#e8574b') {
  const P = (f, b) => paperFast(c, f, b, s * 0.06);
  switch (id) {
    case 'funnel': P(color, k => { k.moveTo(x - s * .45, y - s * .35); k.lineTo(x + s * .45, y - s * .35); k.lineTo(x + s * .1, y + s * .1); k.lineTo(x + s * .1, y + s * .4); k.lineTo(x - s * .1, y + s * .4); k.lineTo(x - s * .1, y + s * .1); k.closePath(); });
      P(shade(color, .35), k => rrect(k, x - s * .45, y - s * .42, s * .9, s * .12, s * .05)); break;
    case 'ramp': for (let i = 0; i < 3; i++) P(i % 2 ? '#c89b6a' : color, k => { const yy = y - s * .35 + i * s * .3; k.moveTo(x - s * .45, yy + (i % 2 ? s * .12 : 0)); k.lineTo(x + s * .45, yy + (i % 2 ? 0 : s * .12)); k.lineTo(x + s * .45, yy + (i % 2 ? 0 : s * .12) + s * .1); k.lineTo(x - s * .45, yy + (i % 2 ? s * .12 : 0) + s * .1); k.closePath(); }); break;
    case 'bell': { const w = Math.sin(t * 18) * Math.max(0, 1 - t) * .4; c.save(); c.translate(x, y - s * .4); c.rotate(w);
      P('#9b7b5b', k => rrect(k, -s * .05, -s * .08, s * .1, s * .14, s * .03));
      P(color, k => { k.moveTo(-s * .38, s * .55); k.quadraticCurveTo(-s * .38, s * .05, 0, s * .04); k.quadraticCurveTo(s * .38, s * .05, s * .38, s * .55); k.closePath(); });
      P(shade(color, -.25), k => k.arc(0, s * .6, s * .1, 0, TAU)); c.restore(); break; }
    case 'paint': P('#fffaf0', k => { k.moveTo(x - s * .32, y - s * .25); k.lineTo(x + s * .32, y - s * .25); k.lineTo(x + s * .25, y + s * .35); k.lineTo(x - s * .25, y + s * .35); k.closePath(); });
      P(color, k => { k.moveTo(x - s * .34, y - s * .25); k.bezierCurveTo(x - s * .2, y - s * .05, x - s * .05, y - s * .3, x + s * .05, y - s * .05); k.bezierCurveTo(x + s * .15, y - s * .25, x + s * .25, y - s * .1, x + s * .34, y - s * .25); k.closePath(); });
      P(shade(color, .2), k => k.arc(x + s * .05, y + s * .02 + (t * 30 % (s * .3)), s * .06, 0, TAU)); break;
    case 'loop': { c.save(); c.translate(x, y); c.rotate(t * 2); for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); P(COLORS[i], k => { k.moveTo(0, 0); k.lineTo(s * .45, -s * .05); k.lineTo(s * .2, -s * .3); k.closePath(); }); } c.restore(); P('#fffaf0', k => k.arc(x, y, s * .08, 0, TAU)); break; }
    case 'spring': { const sq = 1 - Math.max(0, Math.sin(Math.min(1, t * 3) * Math.PI)) * .35; for (let i = 0; i < 5; i++) P(i % 2 ? shade(color, -.2) : color, k => rrect(k, x - s * .3, y + s * .35 - (i + 1) * s * .15 * sq, s * .6, s * .09, s * .04)); P('#9b7b5b', k => rrect(k, x - s * .4, y + s * .35, s * .8, s * .1, s * .03)); break; }
    case 'kiln': P('#c86a4a', k => { k.moveTo(x - s * .4, y + s * .4); k.lineTo(x - s * .4, y); k.arc(x, y, s * .4, Math.PI, 0); k.lineTo(x + s * .4, y + s * .4); k.closePath(); });
      for (let i = 0; i < 4; i++) { c.strokeStyle = COLORS[i]; c.lineWidth = s * .06; c.beginPath(); c.arc(x, y + s * .15, s * (.26 - i * .055), Math.PI, 0); c.stroke(); } break;
    case 'polish': { const tw = 1 + Math.sin(t * 4) * .08; P(color, k => star(k, x, y, s * .45 * tw, s * .2)); P('#fffaf0', k => star(k, x - s * .05, y - s * .05, s * .12, s * .05)); break; }
    case 'lift': P(color, k => { k.arc(x, y, s * .42, Math.PI * .3, Math.PI * 1.7); k.arc(x + s * .18, y - s * .05, s * .32, Math.PI * 1.55, Math.PI * .45, true); k.closePath(); });
      P('#9b7b5b', k => rrect(k, x + s * .15, y + s * .25, s * .25, s * .16, s * .04)); break;
    case 'comet': P(shade(color, .4), k => { k.moveTo(x + s * .1, y - s * .2); k.lineTo(x - s * .48, y + s * .38); k.lineTo(x + s * .25, y + s * .05); k.closePath(); });
      P(color, k => star(k, x + s * .15, y - s * .12, s * .28, s * .14)); break;
    case 'galaxy': P(color, k => gear(k, x, y, s * .44, 7, t * .8)); P('#fffaf0', k => star(k, x, y, s * .12, s * .05)); break;
    case 'dream': P('#fffaf0', k => cloud(k, x - s * .3, y + s * .12, s * .22));
      P(color, k => { const hx = x + s * .02, hy = y - s * .05, r = s * .13; k.moveTo(hx, hy + r * 1.6); k.bezierCurveTo(hx - r * 2.2, hy + r * .2, hx - r * 1.1, hy - r * 1.6, hx, hy - r * .4); k.bezierCurveTo(hx + r * 1.1, hy - r * 1.6, hx + r * 2.2, hy + r * .2, hx, hy + r * 1.6); }); break;
  }
}

// ---- the stage ----
export class Stage {
  constructor(canvas, producers) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.P = producers;
    this.marbles = []; this.parts = []; this.jar = []; this.owned = producers.map(() => 0); this.gadgetT = {}; this.appear = {};
    this.shakeT = 0; this.shakeA = 0; this.time = 0; this.boost = 0; this.bg = document.createElement('canvas');
    this.onLand = null; this.onJarFull = null; this.onGoldenMiss = null; this.jarCap = 20; this.flow = 1;
    this.grain = this.makeGrain();
    this.resize(); addEventListener('resize', () => this.resize());
  }
  makeGrain() { const g = document.createElement('canvas'); g.width = g.height = 96; const k = g.getContext('2d'); const d = k.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = 90; d.data[i + 1] = 60; d.data[i + 2] = 30; d.data[i + 3] = v < 30 ? 40 : v > 235 ? 18 : 0; } k.putImageData(d, 0, 0); return g; }
  resize() {
    const r = this.cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
    this.W = Math.max(120, r.width); this.H = Math.max(120, r.height); this.dpr = dpr;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr; this.bg.width = this.cv.width; this.bg.height = this.cv.height;
    this.mr = Math.max(7, Math.min(10, this.W / 42));
    this.buildPath(); this.drawBg();
  }
  // track: 4 cardboard ramps joined by U-turns, then a drop into the jar
  buildPath() {
    const W = this.W, H = this.H, X = f => f * W, Y = f => f * H;
    const ys = [[0.17, 0.25], [0.35, 0.43], [0.53, 0.61], [0.71, 0.77]];
    this.ramps = [
      [X(0.17), Y(ys[0][0]), X(0.8), Y(ys[0][1])], [X(0.8), Y(ys[1][0]), X(0.22), Y(ys[1][1])],
      [X(0.22), Y(ys[2][0]), X(0.8), Y(ys[2][1])], [X(0.8), Y(ys[3][0]), X(0.44), Y(ys[3][1])]];
    const pts = []; const add = (x, y) => pts.push([x, y]);
    const line = (x1, y1, x2, y2) => { const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3); for (let i = 0; i <= n; i++) add(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n); };
    const turn = (x, y1, y2, dir) => { const cy = (y1 + y2) / 2, r = (y2 - y1) / 2, n = 24; for (let i = 1; i < n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; add(x + dir * Math.cos(a) * r, cy + Math.sin(a) * r); } };
    add(X(0.17), Y(0.08)); line(X(0.17), Y(0.1), X(0.17), Y(ys[0][0]) - 1);
    const R = this.ramps;
    line(...R[0]); turn(X(0.8), R[0][3], R[1][1], 1);
    line(...R[1]); turn(X(0.22), R[1][3], R[2][1], -1);
    line(...R[2]); turn(X(0.8), R[2][3], R[3][1], 1);
    line(...R[3]);
    this.px = new Float32Array(pts.length); this.py = new Float32Array(pts.length); this.ps = new Float32Array(pts.length);
    let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); this.px[i] = p[0]; this.py[i] = p[1]; this.ps[i] = s; });
    this.len = s;
    // jar
    this.jarBox = { x: X(0.07), y: Y(0.82), w: X(0.33), h: Y(0.99) - Y(0.82) };
    const d = this.mr * 2.02, cols = Math.max(4, Math.floor((this.jarBox.w - 8) / d)), rows = Math.max(2, Math.floor((this.jarBox.h - 6) / (d * 0.87)));
    this.slots = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols - (r % 2); c++) this.slots.push([this.jarBox.x + 4 + this.mr + c * d + (r % 2) * d / 2, this.jarBox.y + this.jarBox.h - 3 - this.mr - r * d * 0.87]);
    if (this.jar.length > this.jarCap) this.jar.length = this.jarCap;
    this.jar.forEach((m, i) => { const sl = this.slots[i % this.slots.length]; m.tx = sl[0]; m.ty = sl[1]; m.x = sl[0]; m.y = sl[1]; m.state = 'rest'; });
    // gadget anchors & path triggers
    const sAt = (x, y) => { let b = 0, bd = 1e9; for (let i = 0; i < pts.length; i++) { const dd = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (dd < bd) { bd = dd; b = i; } } return this.ps[b]; };
    this.anchor = {
      funnel: [X(0.17), Y(0.065), 30], ramp: [X(0.5), Y(0.135), 26], bell: [X(0.92), Y(0.255), 30], paint: [X(0.52), Y(0.475), 28],
      loop: [X(0.09), Y(0.48), 32], spring: [X(0.92), Y(0.62), 28], kiln: [X(0.62), Y(0.905), 36], polish: [X(0.37), Y(0.075), 26],
      lift: [X(0.87), Y(0.08), 34], comet: [X(0.62), Y(0.05), 30], galaxy: [X(0.5), Y(0.52), 120], dream: [X(0.85), Y(0.905), 40] };
    this.triggers = { bell: sAt(X(0.8), (R[0][3] + R[1][1]) / 2), paint: sAt(X(0.52), Y(0.58)), loop: sAt(X(0.22) - (R[2][1] - R[1][3]) / 2, (R[1][3] + R[2][1]) / 2), spring: sAt(X(0.8), (R[2][3] + R[3][1]) / 2) };
    this.sAt = sAt;
  }
  setOwned(owned) {
    let changed = false;
    owned.forEach((n, i) => { const had = this.owned[i] > 0, has = n > 0; if (had !== has) { changed = true; if (has) this.appear[this.P[i].id] = this.time; } });
    this.owned = owned.slice(); if (changed) this.drawBg();
  }
  has(id) { const i = this.P.findIndex(p => p.id === id); return i >= 0 && this.owned[i] > 0; }
  drawBg() {
    const c = this.bg.getContext('2d'), W = this.W, H = this.H; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, W, H);
    // sky card
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#cfe6ef'); g.addColorStop(1, '#f6efe0'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (this.has('kiln')) { const cols = ['#ef7fb0', '#f5c542', '#3fb6a8', '#4fa3e0']; cols.forEach((col, i) => { c.globalAlpha = .45; c.strokeStyle = col; c.lineWidth = 10; c.beginPath(); c.arc(W * .5, H * .95, W * (.62 - i * .045), Math.PI, 0); c.stroke(); }); c.globalAlpha = 1; }
    paper(c, '#fffdf7', k => cloud(k, W * .62, H * .2, 16)); paper(c, '#fffdf7', k => cloud(k, W * .05, H * .34, 12)); paper(c, '#fffdf7', k => cloud(k, W * .7, H * .41, 10));
    // hills
    paper(c, '#bfdcae', k => { k.moveTo(0, H); k.lineTo(0, H * .8); k.bezierCurveTo(W * .25, H * .7, W * .45, H * .86, W * .7, H * .76); k.bezierCurveTo(W * .85, H * .7, W * .95, H * .78, W, H * .74); k.lineTo(W, H); k.closePath(); });
    paper(c, '#9dcc8f', k => { k.moveTo(0, H); k.lineTo(0, H * .9); k.bezierCurveTo(W * .3, H * .82, W * .6, H * .95, W, H * .86); k.lineTo(W, H); k.closePath(); });
    // pegboard dots
    c.fillStyle = 'rgba(90,60,30,.10)'; for (let y = 14; y < H * .7; y += 22) for (let x = 12 + (y / 22 % 2) * 11; x < W; x += 22) { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }
    // turn guides (behind)
    const R = this.ramps, cs = this.has('ramp') ? ['#e8574b', '#4fa3e0', '#f5c542', '#3fb6a8'] : ['#c89b6a', '#c3956a', '#c89b6a', '#c3956a'];
    const turnG = (x, y1, y2, dir) => { const cy = (y1 + y2) / 2, r = (y2 - y1) / 2 + this.mr + 3; paper(c, '#b9895a', k => { k.arc(x, cy, r + 6, -Math.PI / 2, Math.PI / 2, dir < 0); k.arc(x, cy, r, Math.PI / 2, -Math.PI / 2, dir > 0); k.closePath(); }); };
    turnG(R[0][2], R[0][3], R[1][1], 1); turnG(R[1][2], R[1][3], R[2][1], -1); turnG(R[2][2], R[2][3], R[3][1], 1);
    // hopper
    const hx = W * .17;
    paper(c, '#e8574b', k => { k.moveTo(hx - 26, H * .02); k.lineTo(hx + 26, H * .02); k.lineTo(hx + 9, H * .12); k.lineTo(hx - 9, H * .12); k.closePath(); });
    c.fillStyle = '#b23a31'; c.fillRect(hx - 26, H * .02, 52, 4);
    // ramps
    R.forEach((r, i) => {
      const [x1, y1, x2, y2] = r, th = 8, oy = this.mr;
      paper(c, cs[i], k => { k.moveTo(x1, y1 + oy); k.lineTo(x2, y2 + oy); k.lineTo(x2, y2 + oy + th); k.lineTo(x1, y1 + oy + th); k.closePath(); });
      c.strokeStyle = 'rgba(80,50,20,.25)'; c.lineWidth = 1; c.beginPath(); for (let f = 0.04; f < 1; f += 0.045) { const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f + oy; c.moveTo(x, y + 2); c.lineTo(x, y + th - 1); } c.stroke();
      // back lip
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(Math.min(x1, x2), 0, 0, 0);
      [0.08, 0.92].forEach(f => { const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f + oy + th / 2; paper(c, '#d7b25a', k => k.arc(x, y, 3, 0, TAU), .4); });
    });
    // jar back
    const j = this.jarBox; c.fillStyle = 'rgba(200,230,240,.45)'; c.beginPath(); rrect(c, j.x, j.y, j.w, j.h, 10); c.fill();
    // static gadgets with real paper shadows
    for (const id of ['funnel', 'ramp', 'paint', 'kiln', 'lift', 'dream']) if (this.has(id)) { const [x, y, s] = this.anchor[id]; const p = this.P.find(q => q.id === id); c.save(); c.shadowColor = 'rgba(70,40,15,.25)'; c.shadowBlur = 5; c.shadowOffsetY = 2; drawGadget(c, id, x, y, s, 0, p.color); c.restore(); }
    // grain
    c.globalAlpha = 1; c.fillStyle = c.createPattern(this.grain, 'repeat'); c.fillRect(0, 0, W, H);
  }
  spawn(o = {}) {
    if (this.marbles.length > 80 && !o.golden && !o.mini) return;
    const m = { s: o.s || 0, v: o.v ?? 90 + Math.random() * 30, golden: !!o.golden, mini: !!o.mini, value: o.value || 0, color: o.golden || o.mini ? '#ffd23f' : COLORS[(Math.random() * COLORS.length) | 0],
      r: o.golden ? this.mr * 1.45 : o.mini ? this.mr * 0.8 : this.mr * (0.9 + Math.random() * 0.2), rot: 0, state: 'path', x: 0, y: 0, vx: 0, vy: 0, tap: !!o.tap, life: 0, quiet: !!o.quiet };
    const [sx0, sy0] = this.pathAt(m.s); m.x = sx0; m.y = sy0; this.marbles.push(m); return m;
  }
  pathAt(s) { let lo = 0, hi = this.ps.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (this.ps[mid] < s) lo = mid + 1; else hi = mid; } const i = Math.max(1, lo); const f = (s - this.ps[i - 1]) / Math.max(1e-6, this.ps[i] - this.ps[i - 1]);
    return [this.px[i - 1] + (this.px[i] - this.px[i - 1]) * f, this.py[i - 1] + (this.py[i] - this.py[i - 1]) * f, (this.py[i] - this.py[i - 1]) / Math.max(1e-6, this.ps[i] - this.ps[i - 1]), (this.px[i] - this.px[i - 1]) / Math.max(1e-6, this.ps[i] - this.ps[i - 1])]; }
  shake(a) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = 0.35; }
  burst(x, y, kind = 'confetti', n = 16, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = kind === 'spark' ? rand(60, 220) : rand(120, 380);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' ? 160 : 40), life: 0, max: rand(.6, 1.3), kind, rot: rand(0, TAU), vr: rand(-12, 12), c: color || COLORS[(Math.random() * COLORS.length) | 0], s: rand(3, 7) });
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }
  hitGolden(x, y) {
    for (const m of this.marbles) if (m.golden && !m.caught && Math.hypot(m.x - x, m.y - y) < m.r + 30) return m;
    for (const m of this.jar) if (m.golden && !m.caught && Math.hypot(m.x - x, m.y - y) < m.r + 30) return m;
    return null;
  }
  // a regular marble near (x,y) that can be popped by a tap
  hitMarble(x, y, pad = 22) {
    let best = null, bd = 1e9;
    for (const m of this.marbles) { if (m.golden || m.popped) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < m.r + pad && d < bd) { bd = d; best = m; } }
    return best;
  }
  popMarble(m) { m.popped = true; this.burst(m.x, m.y, 'spark', 7, m.color); const i = this.marbles.indexOf(m); if (i >= 0) this.marbles.splice(i, 1); }
  catchGolden(m) { m.caught = true; this.burst(m.x, m.y, 'confetti', 40); this.burst(m.x, m.y, 'spark', 20, '#ffd23f'); this.shake(8);
    this.marbles = this.marbles.filter(q => q !== m); const j = this.jar.indexOf(m); if (j >= 0) this.jar.splice(j, 1); }
  update(dt) {
    this.time += dt;
    const G = 1100 * (this.H / 400), boost = this.boost;
    for (const id in this.gadgetT) this.gadgetT[id] += dt;
    for (let i = this.marbles.length - 1; i >= 0; i--) {
      const m = this.marbles[i]; m.life += dt;
      if (m.state === 'path') {
        const [, , dyds] = this.pathAt(m.s);
        const fl = this.flow * (1 + boost * .5), top = m.golden ? 260 : 540 * fl;
        m.v += (G * dyds * fl - 0.6 * m.v) * dt; m.v = Math.max(m.golden ? 55 : 80 * fl, Math.min(top, m.v));
        const prev = m.s; m.s += m.v * dt; m.rot += m.v * dt / m.r;
        for (const id in this.triggers) { const ts = this.triggers[id]; if (prev < ts && m.s >= ts && this.has(id)) { this.gadgetT[id] = 0; if (id === 'paint' && !m.golden) m.color = COLORS[(Math.random() * COLORS.length) | 0]; if (id === 'spring') m.v += 120; this.onGadget && this.onGadget(id, m); } }
        if (m.s >= this.len) { const [x, y, dy, dx] = this.pathAt(this.len); m.state = 'fall'; m.x = x; m.y = y; m.vx = dx * m.v; m.vy = dy * m.v; continue; }
        const [x, y] = this.pathAt(m.s); m.x = x; m.y = y;
      } else if (m.state === 'fall') {
        m.vy += G * dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= 0.99; m.rot += m.vx * dt / m.r;
        const j = this.jarBox; if (m.x < j.x + m.r + 4) { m.x = j.x + m.r + 4; m.vx = Math.abs(m.vx) * .5; }
        if (m.y > j.y) { // into the jar
          if (this.jar.length >= this.jarCap) { this.onJarFull && this.onJarFull(this.jar.slice()); this.jar.forEach(q => this.burst(q.x, q.y, 'spark', 2, q.color)); this.jar = []; }
          const slot = this.slots[this.jar.length % this.slots.length]; m.state = 'settle'; m.tx = slot[0]; m.ty = slot[1]; m.sv = 0; this.jar.push(m); this.marbles.splice(i, 1);
          this.onLand && this.onLand(m);
        }
      }
    }
    for (const m of this.jar) if (m.state === 'settle') { // springy settle
      m.vy += G * dt; m.y += m.vy * dt; m.x += (m.tx - m.x) * Math.min(1, dt * 10);
      if (m.y >= m.ty) { m.y = m.ty; if (Math.abs(m.vy) > 60) { m.vy = -m.vy * 0.35; this.onClack && this.onClack(m); } else { m.vy = 0; m.state = 'rest'; } }
    }
    // golden marbles waiting in the jar fade after a while
    for (let i = this.jar.length - 1; i >= 0; i--) { const m = this.jar[i]; if (m.golden) { m.life += dt; if (m.life > 14) { this.jar.splice(i, 1); this.onGoldenMiss && this.onGoldenMiss(m); } } }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life += dt; if (p.life > p.max) { this.parts.splice(i, 1); continue; }
      p.vy += (p.kind === 'confetti' ? 520 : 160) * dt; p.vx *= p.kind === 'confetti' ? 0.97 : 0.95; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
  }
  drawMarble(c, m) {
    const { x, y, r } = m;
    c.fillStyle = 'rgba(60,35,15,.22)'; c.beginPath(); c.arc(x + 1.5, y + r * .45, r * .95, 0, TAU); c.fill();
    if (m.golden) { const gl = 0.5 + 0.5 * Math.sin(this.time * 8); c.fillStyle = `rgba(255,210,63,${0.25 + gl * 0.25})`; c.beginPath(); c.arc(x, y, r * (1.7 + gl * 0.3), 0, TAU); c.fill(); }
    c.fillStyle = m.color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.strokeStyle = shade(m.color, .45); c.lineWidth = r * .35; c.beginPath(); c.arc(x + Math.cos(m.rot) * r * .3, y + Math.sin(m.rot) * r * .3, r * .7, m.rot, m.rot + 2.2); c.stroke();
    c.fillStyle = shade(m.color, -.28); c.beginPath(); c.arc(x + r * .25, y + r * .35, r * .85, 0, TAU); c.arc(x, y, r * 1.2, 0, TAU, true); c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - r * .35, y - r * .4, r * .28, r * .18, -0.6, 0, TAU); c.fill();
    if (m.golden) { c.fillStyle = '#fff'; c.beginPath(); star(c, x, y, r * .45, r * .2, 5, this.time * 2); c.fill(); }
  }
  draw() {
    const c = this.ctx, W = this.W, H = this.H, t = this.time;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let sx = 0, sy = 0; if (this.shakeT > 0) { const a = this.shakeA * (this.shakeT / 0.35); sx = rand(-a, a); sy = rand(-a, a); }
    c.clearRect(0, 0, W, H); c.save(); c.translate(sx, sy);
    c.drawImage(this.bg, 0, 0, W, H);
    // animated set pieces
    if (this.has('galaxy')) { const [x, y, s] = this.anchor.galaxy; c.globalAlpha = .22; drawGadget(c, 'galaxy', x, y, s, t * (0.4 + this.boost), '#5b7bd5'); c.globalAlpha = 1; }
    if (this.has('comet')) { const f = (t * .12) % 1; drawGadget(c, 'comet', W * (1.1 - f * 1.3), H * (.04 + f * .06), 26, t, '#ff8c42'); }
    if (this.has('polish')) for (let i = 0; i < 5; i++) { const a = .5 + .5 * Math.sin(t * 3 + i * 1.7); c.globalAlpha = a; c.fillStyle = '#ffd166'; c.beginPath(); star(c, W * (.3 + i * .12), H * (.06 + (i % 2) * .05), 5 + a * 3, 2); c.fill(); } c.globalAlpha = 1;
    for (const id of ['bell', 'loop', 'spring']) if (this.has(id)) { const [x, y, s] = this.anchor[id]; const p = this.P.find(q => q.id === id); const at = this.gadgetT[id] ?? 9; drawGadget(c, id, x, y, s, id === 'loop' ? t * (1 + this.boost * 2) + Math.min(at, 1) * 3 : at, p.color); }
    // appear pop rings
    for (const id in this.appear) { const a = t - this.appear[id]; if (a > 1) { delete this.appear[id]; continue; } const an = this.anchor[id]; if (!an) continue; c.strokeStyle = `rgba(245,197,66,${1 - a})`; c.lineWidth = 6 * (1 - a); c.beginPath(); c.arc(an[0], an[1], an[2] * (.4 + a * 1.2), 0, TAU); c.stroke(); }
    for (const m of this.marbles) this.drawMarble(c, m);
    for (const m of this.jar) this.drawMarble(c, m);
    // jar front glass
    const j = this.jarBox; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.beginPath(); rrect(c, j.x, j.y, j.w, j.h, 10); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); rrect(c, j.x + 6, j.y + 6, 7, j.h - 14, 3); c.fill();
    paperFast(c, '#c79b6a', k => rrect(k, j.x - 4, j.y - 6, j.w + 8, 9, 4), 2);
    const fill = this.jar.length / this.jarCap; paperFast(c, '#fffaf0', k => rrect(k, j.x + j.w * .25, j.y + j.h * .35, j.w * .5, 16, 3), 2);
    c.fillStyle = INK; c.font = `12px Lilita, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(fill > .8 ? 'ALMOST!' : 'JAR', j.x + j.w / 2, j.y + j.h * .35 + 8.5);
    // particles
    for (const p of this.parts) { const k = 1 - p.life / p.max; c.globalAlpha = Math.min(1, k * 2); c.fillStyle = p.c;
      if (p.kind === 'confetti') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.s, -p.s * .45, p.s * 2, p.s * .9 * Math.abs(Math.cos(p.rot * 1.3))); c.restore(); }
      else { c.beginPath(); star(c, p.x, p.y, p.s * k + 1, (p.s * k + 1) * .4, 4, p.rot); c.fill(); } }
    c.globalAlpha = 1;
    if (this.boost > 0) { c.fillStyle = `rgba(255,200,80,${0.08 + 0.05 * Math.sin(t * 10)})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }
  // screen position of a canvas point
  toScreen(x, y) { const r = this.cv.getBoundingClientRect(); return [r.left + x, r.top + y]; }
}
