/**
 * The theme tune, synthesised rather than loaded.
 *
 * The game ships with no art assets — every sprite is drawn at boot — and the music
 * follows the same rule: there is no .mp3 anywhere, just oscillators and an envelope.
 * Both tunes are just the tables of notes below.
 */

/** Equal temperament from A4 = 440, so notes can be written by name. */
const NOTES: Record<string, number> = {
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  C4: 261.63,
  D4: 293.66,
  F4: 349.23,
};

/** One note: which pitch, and how many eighth-notes it is held for. */
export interface Note {
  /** A name from NOTES, or null for a rest. */
  name: string | null;
  beats: number;
  /** The syllable he sang, kept so the tune can be read back against what he asked. */
  say: string;
}

/** Seconds per eighth-note. Slow enough to feel like a dungeon rather than a race. */
export const BEAT = 0.22;

/**
 * "dum dumdum dummmm dom dom dam"
 *
 * Read straight off what he sang: one, then two quick ones run together, then the
 * long one, then three coming back down. The vowel changing from "u" to "o" to "a"
 * is where the tune turns around, so the held "dummmm" is the top note and the
 * "dom dom dam" walks back down to home.
 */
const PHRASE: { say: string; beats: number }[] = [
  { say: 'dum', beats: 2 },
  { say: 'dum', beats: 1 },
  { say: 'dum', beats: 1 },
  { say: 'dummmm', beats: 4 },
  { say: 'dom', beats: 2 },
  { say: 'dom', beats: 2 },
  { say: 'dam', beats: 4 },
];

const phrase = (pitches: string[]): Note[] =>
  PHRASE.map((p, i) => ({ name: pitches[i], beats: p.beats, say: p.say }));

/**
 * The tune asks, then answers, then rests and goes round again.
 *
 * Both halves are his rhythm note for note. The first lands back on D — home, settled.
 * The second is the same shape moved up, ending on A instead, which does not settle,
 * which is what makes it want to come round to the beginning again.
 */
export const DUM_THEME: Note[] = [
  ...phrase(['D3', 'D3', 'D3', 'A3', 'F3', 'E3', 'D3']),
  { name: null, beats: 2, say: '(breath)' },
  ...phrase(['F3', 'F3', 'F3', 'C4', 'A3', 'G3', 'A3']),
  { name: null, beats: 4, say: '(breath)' },
];

/**
 * "boy girl cat mouse cheese" — the second theme.
 *
 * A chase: each word is one step up the stairs, with "cat mouse" run together quickly
 * because the cat is right behind the mouse, and "cheese" held at the top because that
 * is what everyone was running for. The first time, cheese is C — up high and unsettled,
 * still being chased. The second time they all run back down and cheese lands on D,
 * home, which hands straight back to the first theme's opening D.
 */
const CHEESE: { say: string; beats: number }[] = [
  { say: 'boy', beats: 2 },
  { say: 'girl', beats: 2 },
  { say: 'cat', beats: 1 },
  { say: 'mouse', beats: 1 },
  { say: 'cheese', beats: 4 },
];

const cheese = (pitches: string[]): Note[] =>
  CHEESE.map((p, i) => ({ name: pitches[i], beats: p.beats, say: p.say }));

export const CHEESE_THEME: Note[] = [
  ...cheese(['D3', 'F3', 'G3', 'A3', 'C4']),
  { name: null, beats: 2, say: '(breath)' },
  ...cheese(['C4', 'A3', 'G3', 'F3', 'D3']),
  { name: null, beats: 4, say: '(breath)' },
];

/** The two themes take turns: dum dumdum, then boy girl cat mouse cheese, then round. */
export const THEME: Note[] = [...DUM_THEME, ...CHEESE_THEME];

/** How long one time round the loop takes, in seconds. */
export const themeLength = (): number => THEME.reduce((t, n) => t + n.beats * BEAT, 0);

/** Hertz for a note name. Unknown names fall silent rather than screech. */
export const frequencyOf = (name: string): number => NOTES[name] ?? 0;

/** How far ahead of the speakers notes are queued up, in seconds. */
const LOOKAHEAD = 0.3;

/**
 * Plays the theme on a loop.
 *
 * Notes are scheduled against the audio clock rather than a setInterval, because a
 * timer that fires late makes the tune stumble; the audio clock does not care what
 * the rest of the frame is doing. A timer only decides *when to queue up more*.
 */
export class Music {
  private ctx?: AudioContext;
  private master?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  /** Where in THEME the scheduler has got to. Keeps counting up, and wraps on read. */
  private step = 0;
  /** Audio-clock time the next note starts at. */
  private nextTime = 0;
  private on = false;

  get playing(): boolean {
    return this.on;
  }

  start(): void {
    if (this.on) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // No Web Audio at all: the game is simply silent.

    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // Quiet enough to talk over. It is a background tune, not the game.
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    // Browsers hold the context suspended until a real key or click; resume() is a
    // promise that is allowed to reject, and a rejection here just means silence.
    void this.ctx.resume().catch(() => undefined);

    this.on = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.pump(), 40);
    this.pump();
  }

  stop(): void {
    this.on = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Notes already queued are in the past or nearly so; cutting the master gain
    // stops the tail of anything still ringing without a click.
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }

  toggle(): boolean {
    if (this.on) this.stop();
    else {
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.02);
      this.start();
    }
    return this.on;
  }

  /** Queues every note that starts inside the lookahead window. */
  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const note = THEME[this.step % THEME.length];
      const length = note.beats * BEAT;
      if (note.name) voice(this.ctx!, this.master!, frequencyOf(note.name), this.nextTime, length);
      this.nextTime += length;
      this.step++;
    }
  }

  /**
   * Renders the tune to an audio buffer instead of the speakers.
   *
   * Same synthesis, different clock — which is the point: it is how the tune can be
   * listened to outside the game, and how it can be checked that it actually makes a
   * sound rather than merely that a flag flipped.
   */
  async render(loops = 1): Promise<AudioBuffer> {
    const rate = 44100;
    const seconds = themeLength() * loops + 0.5;
    const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    let at = 0.05;
    for (let i = 0; i < loops; i++) {
      for (const note of THEME) {
        const length = note.beats * BEAT;
        if (note.name) voice(ctx, master, frequencyOf(note.name), at, length);
        at += length;
      }
    }
    return ctx.startRendering();
  }
}

/**
 * One "dum". A triangle for the body and a quiet detuned square for the edge, run
 * through a lowpass so it reads as warm rather than as a games console, plus a sine
 * an octave down on the longer notes to give them weight.
 */
function voice(
  ctx: BaseAudioContext,
  master: AudioNode,
  freq: number,
  at: number,
  length: number
): void {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.7;
  filter.connect(gain);
  gain.connect(master);

  const voices: OscillatorNode[] = [];
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = freq;
  body.connect(filter);
  voices.push(body);

  const edge = ctx.createOscillator();
  edge.type = 'square';
  edge.frequency.value = freq;
  edge.detune.value = 8;
  const edgeGain = ctx.createGain();
  edgeGain.gain.value = 0.22;
  edge.connect(edgeGain).connect(filter);
  voices.push(edge);

  // The held notes are the ones that carry the tune, so they get the low end.
  // Kept well under the triangle on purpose: at half gain the octave below was
  // louder than the note itself, which reads as a bass rumble rather than a tune.
  if (length >= BEAT * 2) {
    const low = ctx.createOscillator();
    low.type = 'sine';
    low.frequency.value = freq / 2;
    const lowGain = ctx.createGain();
    lowGain.gain.value = 0.26;
    low.connect(lowGain).connect(filter);
    voices.push(low);
  }

  // Struck rather than blown: a fast attack, then it rings and fades. The release
  // never runs past the note, so two notes never overlap into mud.
  const end = at + length;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.9, at + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.35, at + Math.min(0.18, length * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.01);

  for (const v of voices) {
    v.start(at);
    v.stop(end);
  }
  body.onended = () => {
    gain.disconnect();
    filter.disconnect();
  };
}

/** One tune for the whole game — it plays across every scene rather than per scene. */
export const music = new Music();
