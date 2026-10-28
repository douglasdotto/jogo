// Sons do jogo gerados na hora com Web Audio (sem arquivos): efeitos de combate e música medieval.
// O navegador só libera o áudio depois de um clique, por isso tudo começa em unlock().

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = true;
try { muted = localStorage.getItem('cavaleiros-mudo') !== '0'; } catch {}

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('cavaleiros-mudo', v ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(v ? 0 : 0.8, ctx.currentTime, 0.05);
}

// ---------- blocos básicos ----------
function env(gain, t, a, d, peak = 1) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(type, f0, f1, dur, vol = 0.4, bus = sfxBus, when = 0) {
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, dur, vol);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.3, filter = 'bandpass', freq = 2000, q = 1, when = 0, sweepTo = 0) {
  const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  env(g, t, 0.004, dur, vol);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// ---------- efeitos ----------
const SFX = {
  sword: () => { noise(0.12, 0.35, 'highpass', 3000, 0.7, 0, 6000); tone('triangle', 900, 1400, 0.08, 0.08); },
  axe: () => { noise(0.18, 0.4, 'bandpass', 900, 1, 0, 300); tone('sine', 120, 60, 0.15, 0.3); },
  hit: () => { noise(0.08, 0.3, 'lowpass', 1200, 1); tone('square', 180, 90, 0.07, 0.08); },
  hurt: () => { tone('sawtooth', 300, 140, 0.18, 0.12); noise(0.1, 0.2, 'lowpass', 900); },
  bones: () => { for (let i = 0; i < 5; i++) noise(0.04, 0.25, 'bandpass', 2500 + Math.random() * 2500, 6, i * 0.045); tone('triangle', 500, 200, 0.2, 0.08); },
  fire: () => { noise(0.45, 0.35, 'lowpass', 600, 0.8, 0, 2400); tone('sawtooth', 110, 55, 0.4, 0.1); },
  ice: () => { for (let i = 0; i < 4; i++) tone('sine', 1800 + i * 400, 2600 + i * 300, 0.25, 0.08, sfxBus, i * 0.04); noise(0.3, 0.12, 'highpass', 5000); },
  zap: () => { tone('sawtooth', 1200, 200, 0.22, 0.15); noise(0.18, 0.2, 'bandpass', 3500, 3); },
  arrow: () => { noise(0.16, 0.25, 'bandpass', 4000, 2, 0, 1500); tone('triangle', 700, 300, 0.1, 0.06); },
  heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, 0, 0.35, 0.12, sfxBus, i * 0.07)); },
  shout: () => { tone('sawtooth', 220, 330, 0.35, 0.15); tone('sawtooth', 277, 415, 0.35, 0.1); noise(0.3, 0.12, 'bandpass', 800, 1); },
  slam: () => { tone('sine', 90, 35, 0.5, 0.6); noise(0.4, 0.4, 'lowpass', 400, 1, 0, 120); },
  summon: () => { tone('sine', 220, 110, 0.6, 0.15); tone('triangle', 330, 165, 0.6, 0.08); noise(0.5, 0.12, 'bandpass', 600, 4, 0, 200); },
  levelup: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.18, 0.08, sfxBus, i * 0.08)); },
  victory: () => { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.25, 0.1, sfxBus, i * 0.14)); },
  defeat: () => { [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.5, 0.14, sfxBus, i * 0.32)); },
  click: () => tone('square', 660, 880, 0.05, 0.06),
};
const last = {};
export function play(name) {
  if (!ctx || muted || !SFX[name]) return;
  const now = ctx.currentTime;
  if (now - (last[name] || 0) < 0.04) return;   // evita empilhar o mesmo som no mesmo instante
  last[name] = now;
  SFX[name]();
}

// ---------- música: alaúde em modo dórico, tambor e bordão; fica mais sombria com "gloom" ----------
let musicOn = false, nextNote = 0, step = 0, gloom = 0, timer = null;
const DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MELODY = [0, 2, 4, 3, 2, 1, 0, -1, 0, 2, 4, 5, 4, 2, 1, 0];
function pluck(freq, t, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'triangle'; o2.type = 'sawtooth';
  o.frequency.value = freq; o2.frequency.value = freq * 1.003;
  f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.4);
  env(g, t, 0.004, 0.6, vol);
  o.connect(f); o2.connect(f); f.connect(g).connect(musicBus);
  o.start(t); o2.start(t); o.stop(t + 0.7); o2.stop(t + 0.7);
}
function drum(t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  env(g, t, 0.003, 0.2, vol);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.25);
}
function schedule() {
  const beat = 0.32 + gloom * 0.08;
  while (nextNote < ctx.currentTime + 0.4) {
    const scale = gloom > 0.5 ? PHRYGIAN : DORIAN, root = 146.8 * (gloom > 0.5 ? 0.89 : 1);
    const deg = MELODY[step % MELODY.length], oct = Math.floor(deg / 7), idx = ((deg % 7) + 7) % 7;
    if (step % 2 === 0 || Math.random() < 0.35) pluck(root * 2 * Math.pow(2, (scale[idx] + oct * 12) / 12), nextNote, 0.16);
    if (step % 4 === 0) { pluck(root / 2, nextNote, 0.12); drum(nextNote, 0.35); }
    if (step % 8 === 6) drum(nextNote, 0.2);
    nextNote += beat;
    step++;
  }
}
export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  nextNote = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 120);
}
export function stopMusic() { musicOn = false; clearInterval(timer); }
export function setGloom(g) { gloom = g; }
