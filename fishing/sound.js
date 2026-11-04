// ============================================================
//  All sounds are synthesized with the Web Audio API — no files.
//  Browsers only allow audio after a user click, so initAudio()
//  is called from the first click / key press.
// ============================================================
let ctx = null, master = null, noiseBuf = null, strain = null;
let muted = false;
try { muted = localStorage.getItem('fishing-muted') === '1'; } catch { /* ignore */ }

export const isMuted = () => muted;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  // 2 seconds of white noise, reused for water, wind, splashes, clicks
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('fishing-muted', muted ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  return muted;
}

// ---------- small building blocks ----------
function noiseSrc() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.loopStart = Math.random(); // start somewhere random so repeats don't sound identical
  return s;
}
function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}
// quick attack, exponential fade out
function envGain(t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
function tone(type, f0, f1, t, dur, peak, attack = 0.005) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  chain(o, envGain(t, peak, attack, dur), master);
  o.start(t); o.stop(t + attack + dur + 0.05);
}
function burst(type, freq, t, dur, peak, q = 1) {
  const s = noiseSrc();
  chain(s, filter(type, freq, q), envGain(t, peak, 0.005, dur), master);
  s.start(t); s.stop(t + dur + 0.05);
}
const ready = () => ctx && !muted;

// ---------- background: water, breeze, birds ----------
function startAmbience() {
  // water lapping: low rumble whose volume slowly rises and falls
  const water = ctx.createGain(); water.gain.value = 0.07;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.04;
  chain(lfo, lfoAmt, water.gain);
  const waterSrc = noiseSrc();
  chain(waterSrc, filter('lowpass', 420, 0.7), water, master);
  // breeze: soft high hiss
  const wind = ctx.createGain(); wind.gain.value = 0.012;
  const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.07;
  const wAmt = ctx.createGain(); wAmt.gain.value = 0.008;
  chain(wlfo, wAmt, wind.gain);
  const ws = noiseSrc();
  chain(ws, filter('bandpass', 1400, 0.6), wind, master);
  for (const n of [lfo, wlfo, ws, waterSrc]) n.start();
  scheduleBird();
}
function scheduleBird() {
  setTimeout(() => { if (ready()) bird(); scheduleBird(); }, 4000 + Math.random() * 9000);
}
function bird() {
  const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2400 + Math.random() * 1200;
  const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(master);
  for (let i = 0; i < n; i++) {
    const s = t + i * 0.16, o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, s + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 1.1, s + 0.11);
    chain(o, envGain(s, 0.03, 0.01, 0.1), pan);
    o.start(s); o.stop(s + 0.15);
  }
}

// ---------- game sounds ----------
export function sfxCast(power) {            // whoosh: noise swept upward
  if (!ready()) return;
  const t = ctx.currentTime, s = noiseSrc(), f = filter('bandpass', 400, 1.2);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
  chain(s, f, envGain(t, 0.15 + power * 0.25, 0.05, 0.35), master);
  s.start(t); s.stop(t + 0.5);
}
export function sfxPlop(size = 1) {         // bobber hits the water
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sine', 520, 110, t, 0.16, 0.28 * size);
  burst('lowpass', 1600, t, 0.18 * size, 0.12 * size);
}
export function sfxNibble() {
  if (!ready()) return;
  tone('sine', 700, 320, ctx.currentTime, 0.07, 0.08);
}
export function sfxBite() {                 // splash + bright "ping"
  if (!ready()) return;
  const t = ctx.currentTime;
  sfxPlop(1.2);
  tone('triangle', 880, 880, t + 0.02, 0.12, 0.12);
  tone('triangle', 1320, 1320, t + 0.12, 0.2, 0.12);
}
export function sfxSplash(size = 1) {
  if (!ready()) return;
  burst('lowpass', 2200, ctx.currentTime, 0.25 * size, 0.14 * size);
}
export function sfxReelTick() {             // one click of the reel
  if (!ready()) return;
  burst('highpass', 3500, ctx.currentTime, 0.012, 0.1);
}
export function setStrain(level) {          // humming line when tension is high, 0 = silent
  if (!ctx) return;
  if (!strain) {
    const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vAmt = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 95;
    vib.frequency.value = 9; vAmt.gain.value = 6;
    chain(vib, vAmt, o.frequency);
    g.gain.value = 0;
    chain(o, filter('lowpass', 700), g, master);
    o.start(); vib.start();
    strain = g;
  }
  strain.gain.setTargetAtTime(muted ? 0 : level, ctx.currentTime, 0.05);
}
export function sfxSnap() {                 // line breaks: crack + falling twang
  if (!ready()) return;
  const t = ctx.currentTime;
  burst('highpass', 2500, t, 0.05, 0.3);
  tone('sawtooth', 240, 55, t, 0.35, 0.12);
}
export function sfxEscape() {               // sad two-note drop
  if (!ready()) return;
  const t = ctx.currentTime;
  tone('sine', 392, 392, t, 0.18, 0.1);
  tone('sine', 294, 294, t + 0.18, 0.3, 0.1);
}
export function sfxCatch(rarity) {          // rising arpeggio, longer for rarer fish
  if (!ready()) return;
  const t = ctx.currentTime;
  const notes = { Common: [523, 659, 784], Uncommon: [523, 659, 784, 1047], Rare: [523, 659, 784, 1047, 1319],
    Legendary: [523, 659, 784, 1047, 1319, 1568, 2093] }[rarity] || [523, 659, 784];
  notes.forEach((f, i) => tone('triangle', f, f, t + i * 0.09, 0.35, 0.13));
  if (rarity === 'Legendary') {             // extra shimmer
    for (let i = 0; i < 8; i++) tone('sine', 2093 + i * 140, 2093 + i * 140, t + 0.6 + i * 0.05, 0.25, 0.04);
  }
}
