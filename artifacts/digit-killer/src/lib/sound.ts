const SOUND_KEY = "dk_sound_enabled";

let _enabled: boolean = localStorage.getItem(SOUND_KEY) !== "false";
let audioCtx: AudioContext | null = null;

export function getSoundEnabled(): boolean { return _enabled; }

export function setSoundEnabled(v: boolean): void {
  _enabled = v;
  localStorage.setItem(SOUND_KEY, String(v));
}

export function toggleSound(): boolean {
  setSoundEnabled(!_enabled);
  return _enabled;
}

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function playBuySound(): void {
  if (!_enabled) return;
  try {
    const ctx = getCtx();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.35);
    });
  } catch {}
}

export function playWarnSound(): void {
  if (!_enabled) return;
  try {
    const ctx = getCtx();
    [[320, 0], [220, 0.22]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    });
  } catch {}
}

export function unlockAudio(): void {
  try { getCtx(); } catch {}
}
