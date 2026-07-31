// ═══════════════════════════════════════════════════════
//  audio.js — Web Audio API Synthesizer (No External Files)
// ═══════════════════════════════════════════════════════

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Master volume ──────────────────────────────────────
function createGain(level = 0.3) {
  const ac = getCtx();
  const g = ac.createGain();
  g.gain.value = level;
  g.connect(ac.destination);
  return g;
}

// ── Spin Sound: rapid frequency sweep (triangle) ───────
export function playSpin() {
  try {
    const ac = getCtx();
    const master = createGain(0.18);
    const ticks = 6;
    for (let i = 0; i < ticks; i++) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + i * 140, ac.currentTime + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(440 + i * 160, ac.currentTime + i * 0.06 + 0.05);
      env.gain.setValueAtTime(0.6, ac.currentTime + i * 0.06);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.06 + 0.06);
      osc.connect(env);
      env.connect(master);
      osc.start(ac.currentTime + i * 0.06);
      osc.stop(ac.currentTime + i * 0.06 + 0.07);
    }
  } catch(e) { /* audio not critical */ }
}

// ── Pick Sound: crisp chime ────────────────────────────
export function playPick() {
  try {
    const ac = getCtx();
    const master = createGain(0.3);
    // Bright sine + overtone
    [[880, 0], [1320, 0.04], [1760, 0.08]].forEach(([freq, delay]) => {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ac.currentTime + delay);
      env.gain.linearRampToValueAtTime(0.7, ac.currentTime + delay + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.4);
      osc.connect(env);
      env.connect(master);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + 0.42);
    });
  } catch(e) { }
}

// ── Skip Sound: low sawtooth thud ─────────────────────
export function playSkip() {
  try {
    const ac = getCtx();
    const master = createGain(0.22);
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.15);
    env.gain.setValueAtTime(0.8, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
    osc.connect(env);
    env.connect(master);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.2);
  } catch(e) { }
}

// ── Whistle Sound: tournament start ───────────────────
export function playWhistle() {
  try {
    const ac = getCtx();
    const master = createGain(0.3);
    // Two-tone whistle
    [[880, 0, 0.18], [1100, 0.22, 0.18], [880, 0.44, 0.25]].forEach(([freq, start, dur]) => {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ac.currentTime + start);
      env.gain.linearRampToValueAtTime(0.7, ac.currentTime + start + 0.02);
      env.gain.setValueAtTime(0.7, ac.currentTime + start + dur - 0.04);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
      osc.connect(env);
      env.connect(master);
      osc.start(ac.currentTime + start);
      osc.stop(ac.currentTime + start + dur + 0.01);
    });
  } catch(e) { }
}

// ── Fanfare: victory ───────────────────────────────────
export function playFanfare() {
  try {
    const ac = getCtx();
    const master = createGain(0.25);
    const notes = [
      [523.25, 0],    // C5
      [659.25, 0.12], // E5
      [783.99, 0.24], // G5
      [1046.5, 0.36], // C6
      [783.99, 0.52], // G5
      [1046.5, 0.64], // C6 (big end)
    ];
    notes.forEach(([freq, start]) => {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ac.currentTime + start);
      env.gain.linearRampToValueAtTime(0.8, ac.currentTime + start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + 0.18);
      osc.connect(env);
      env.connect(master);
      osc.start(ac.currentTime + start);
      osc.stop(ac.currentTime + start + 0.2);
    });
  } catch(e) { }
}

// ── Unlock click (card deal) ───────────────────────────
export function playCardDeal() {
  try {
    const ac = getCtx();
    const master = createGain(0.2);
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.08);
    env.gain.setValueAtTime(0.5, ac.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.connect(env);
    env.connect(master);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.12);
  } catch(e) { }
}
