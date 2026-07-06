/**
 * Minimal Web Audio SFX for the workout timer.
 * No external assets — all tones generated in-browser.
 */

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSfxEnabled(v: boolean) {
  enabled = v;
}

export function isSfxEnabled() {
  return enabled;
}

/** Prime the audio context after a user gesture. */
export function primeAudio() {
  getCtx();
}

function tone(freq: number, duration = 0.12, type: OscillatorType = "sine", gain = 0.15) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

/** Short pip for the last 3 seconds countdown. */
export function sfxTick() {
  tone(880, 0.08, "square", 0.08);
}

/** Longer "go" beep at the start of a work phase. */
export function sfxGo() {
  tone(1320, 0.22, "triangle", 0.18);
}

/** Rest phase begin — softer tone. */
export function sfxRest() {
  tone(520, 0.28, "sine", 0.14);
}

/** Session complete fanfare. */
export function sfxDone() {
  tone(660, 0.18, "triangle", 0.18);
  setTimeout(() => tone(880, 0.18, "triangle", 0.18), 160);
  setTimeout(() => tone(1180, 0.35, "triangle", 0.2), 320);
}
