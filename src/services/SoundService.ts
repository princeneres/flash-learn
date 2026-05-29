// Lightweight, synthesized study sounds via the Web Audio API.
// No audio assets to ship — each effect is a few scheduled oscillator notes.
// Kept deliberately subtle (low gain, short decay) so it never tires the user
// during long review sessions.

export type SoundName = 'flip' | 'again' | 'good' | 'easy' | 'complete';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Start offset in seconds, relative to playback. */
  at: number;
  /** Duration in seconds. */
  dur: number;
  /** Peak gain (0–1). Effects stay well below 1 to remain gentle. */
  gain?: number;
  type?: OscillatorType;
}

// Each effect is a small note sequence. Frequencies use the C-major scale so
// rewards (good/easy/complete) sound pleasant and "again" sounds soft/low.
const RECIPES: Record<SoundName, Note[]> = {
  flip: [{ freq: 392, at: 0, dur: 0.07, gain: 0.05, type: 'triangle' }],
  again: [
    { freq: 311, at: 0, dur: 0.12, gain: 0.06, type: 'sine' },
    { freq: 233, at: 0.09, dur: 0.16, gain: 0.06, type: 'sine' },
  ],
  good: [{ freq: 523, at: 0, dur: 0.14, gain: 0.06, type: 'sine' }],
  easy: [
    { freq: 523, at: 0, dur: 0.1, gain: 0.06, type: 'sine' },
    { freq: 784, at: 0.08, dur: 0.16, gain: 0.06, type: 'sine' },
  ],
  complete: [
    { freq: 523, at: 0, dur: 0.12, gain: 0.07, type: 'sine' },
    { freq: 659, at: 0.1, dur: 0.12, gain: 0.07, type: 'sine' },
    { freq: 784, at: 0.2, dur: 0.14, gain: 0.07, type: 'sine' },
    { freq: 1047, at: 0.32, dur: 0.22, gain: 0.07, type: 'sine' },
  ],
};

function scheduleNote(audio: AudioContext, note: Note, start: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const peak = note.gain ?? 0.06;
  const t0 = start + note.at;
  const t1 = t0 + note.dur;

  osc.type = note.type ?? 'sine';
  osc.frequency.value = note.freq;

  // Quick attack, smooth exponential release — avoids clicks.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

export const SoundService = {
  /** Play a named effect. Safe to call before any user gesture (no-op if the
   *  context can't start yet). Never throws. */
  play(name: SoundName): void {
    const audio = getCtx();
    if (!audio) return;
    // Browsers suspend the context until a user gesture; study taps qualify.
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    const recipe = RECIPES[name];
    if (!recipe) return;
    const start = audio.currentTime + 0.001;
    for (const note of recipe) scheduleNote(audio, note, start);
  },
};
