// Tiny WebAudio synth: every sound is generated in code.
let ac = null, master = null, muted = false, noiseBuf = null;
const last = {};
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  } catch (e) { ac = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.3, q = 3) {
  const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
export function sfx(name, p = 0) {
  if (!ac || muted) return;
  const now = performance.now(); const gap = { clack: 45, ding: 120, land: 40 }[name] || 0;
  if (gap && now - (last[name] || 0) < gap) return; last[name] = now;
  switch (name) {
    case 'press': tone(180 + p * 40, 0.09, 'triangle', 0.25, 0.5); noise(0.04, 2400, 0.2); tone(520 + p * 70, 0.08, 'sine', 0.12, 1.4, 0.02); break;
    case 'clack': noise(0.03, 3200 + Math.random() * 1500, 0.22, 6); tone(1400 + Math.random() * 400, 0.03, 'square', 0.03); break;
    case 'land': noise(0.05, 1800 + Math.random() * 800, 0.18, 4); break;
    case 'ding': tone(1320, 0.6, 'sine', 0.12); tone(1980, 0.4, 'sine', 0.05); break;
    case 'boing': tone(220, 0.25, 'sine', 0.15, 2.5); break;
    case 'buy': tone(660, 0.08, 'triangle', 0.2); tone(990, 0.14, 'triangle', 0.18, 1, 0.06); break;
    case 'no': tone(160, 0.12, 'square', 0.06, 0.8); break;
    case 'gold': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, 1, i * 0.06)); noise(0.3, 6000, 0.1, 1); break;
    case 'milestone': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'square', 0.07, 1, i * 0.08)); break;
    case 'jar': [880, 1100, 1320].forEach((f, i) => tone(f, 0.18, 'sine', 0.14, 1, i * 0.05)); break;
    case 'lever': tone(90, 0.5, 'sawtooth', 0.12, 3); noise(0.25, 900, 0.2, 1); break;
    case 'fanfare': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, 1, i * 0.09)); break;
    case 'tab': tone(900, 0.03, 'sine', 0.08); break;
  }
}
