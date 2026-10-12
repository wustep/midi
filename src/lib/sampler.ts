/**
 * A tiny lazy-loading sampler: a handful of recorded notes per instrument, repitched to fill the range.
 * Samples are fetched only when an instrument is first selected or played, then cached.
 */

export interface Instrument {
  id: string;
  name: string;
  family: string;
  source: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  /** MIDI note numbers that have a file at /samples/<id>/<note>.mp3 */
  notes: number[];
  range: [number, number];
  release: number;
  sustain: boolean;
  drumMap?: Record<string, string>;
  bytes: number;
  /** Sustained instruments with baked-in crossfade loops: loop points in seconds on the encoder's input timeline. */
  loop?: boolean;
  loops?: Record<string, { start: number; end: number }>;
  /** Samples (at 44.1 kHz) fed to the encoder, per note, to detect whether the decoder kept the encoder delay. */
  pcmSamples?: Record<string, number>;
  /** Leading samples an MP3 encoder adds; some decoders keep them, which shifts loop points. */
  encoderDelay?: number;
}

/**
 * Loop points in decoded-buffer seconds. Decoders that honour the gapless (LAME) header return exactly
 * pcmSamples; others return at least encoderDelay extra leading samples, so the loop shifts by that much.
 */
export function alignLoop(inst: Pick<Instrument, 'loops' | 'pcmSamples' | 'encoderDelay'>, note: number, decodedSeconds: number): { start: number; end: number } | null {
  const loop = inst.loops?.[note];
  const pcm = inst.pcmSamples?.[note];
  if (!loop || pcm === undefined) return null;
  const extra = decodedSeconds - pcm / 44100;
  const delay = (inst.encoderDelay ?? 0) / 44100;
  const shift = delay > 0 && extra >= delay - 1e-4 ? delay : 0;
  return { start: loop.start + shift, end: loop.end + shift };
}

/** The recorded note to play for `note`, and the playback rate that repitches it. */
export function pickSample(inst: Pick<Instrument, 'notes' | 'drumMap'>, note: number): { sample: number; rate: number } | null {
  if (inst.drumMap) return inst.notes.includes(note) ? { sample: note, rate: 1 } : null;
  if (!inst.notes.length) return null;
  let best = inst.notes[0];
  for (const n of inst.notes) {
    // Prefer the closer sample; on a tie, repitch downward (from the higher sample), which sounds more natural.
    if (Math.abs(n - note) < Math.abs(best - note) || (Math.abs(n - note) === Math.abs(best - note) && n > best)) best = n;
  }
  return { sample: best, rate: 2 ** ((note - best) / 12) };
}

export function playable(inst: Pick<Instrument, 'range' | 'notes' | 'drumMap'>, note: number): boolean {
  if (inst.drumMap) return inst.notes.includes(note);
  return note >= inst.range[0] && note <= inst.range[1];
}

/** Map a velocity 1–127 to gain, with a gentle curve so soft notes stay audible. */
export const velocityGain = (v: number) => 0.08 + 0.92 * (Math.max(0, Math.min(127, v)) / 127) ** 1.6;

/**
 * Computer-keyboard layout (two rows, like most DAWs): A W S E D F T G Y H U J K O L P ; ' play
 * C to F an octave and a bit up; Z and X shift octaves. Returns semitone offsets from the base C.
 */
export const KEYMAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};

interface Playing {
  src: AudioBufferSourceNode;
  gain: GainNode;
  held: boolean;
}

export class Sampler {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  private buffers = new Map<string, Promise<Map<number, AudioBuffer>>>();
  /** Decoded buffers by instrument id, once loaded, so scheduled notes can start synchronously. */
  private ready = new Map<string, Map<number, AudioBuffer>>();
  private voices = new Map<number, Playing[]>();
  private sustained = new Set<Playing>();
  inst?: Instrument;
  sustainPedal = false;
  base = '/sounds';

  constructor(ctx: AudioContext, destination: AudioNode = ctx.destination, compress = true) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    if (compress) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      this.out.connect(comp).connect(destination);
    } else this.out.connect(destination);
  }

  /** Fetch and decode every sample of an instrument (once). */
  load(inst: Instrument, onProgress?: (done: number, total: number) => void): Promise<Map<number, AudioBuffer>> {
    let p = this.buffers.get(inst.id);
    if (!p) {
      let done = 0;
      p = Promise.all(
        inst.notes.map(async (n) => {
          const res = await fetch(`${this.base}/${inst.id}/${n}.mp3`);
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${inst.id}/${n}.mp3`);
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          onProgress?.(++done, inst.notes.length);
          return [n, buf] as const;
        }),
      ).then((pairs) => {
        const map = new Map(pairs);
        this.ready.set(inst.id, map);
        return map;
      });
      // Let a failed load be retried.
      p.catch(() => this.buffers.delete(inst.id));
      this.buffers.set(inst.id, p);
    }
    return p;
  }

  isLoaded(id: string) {
    return this.ready.has(id);
  }

  /**
   * Start a note. `when` is an AudioContext time (default: now); `scale` multiplies the velocity gain
   * (channel volume). If the instrument isn't loaded yet it loads first and plays as soon as it can.
   */
  async noteOn(note: number, velocity = 96, when?: number, scale = 1, opts: { ignoreRange?: boolean } = {}) {
    const inst = this.inst;
    if (!inst || (!opts.ignoreRange && !playable(inst, note))) return;
    const pick = pickSample(inst, note);
    if (!pick) return;
    let buffers = this.ready.get(inst.id);
    if (!buffers) {
      buffers = await this.load(inst);
      when = undefined;
    }
    if (this.inst !== inst) return;
    const buffer = buffers.get(pick.sample);
    if (!buffer) return;
    const t = Math.max(when ?? 0, this.ctx.currentTime);
    // Retriggering the same key: fade the previous voice quickly (except drums, which can overlap).
    if (!inst.drumMap) for (const v of this.voices.get(note) ?? []) this.fade(v, 0.05, t);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pick.rate;
    if (inst.loop) {
      const lp = alignLoop(inst, pick.sample, buffer.duration);
      if (lp && lp.end <= buffer.duration) {
        src.loop = true;
        src.loopStart = lp.start;
        src.loopEnd = lp.end;
      }
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(velocityGain(velocity) * scale, t + 0.004);
    src.connect(gain).connect(this.out);
    src.start(t);
    const v: Playing = { src, gain, held: true };
    const list = this.voices.get(note) ?? [];
    list.push(v);
    this.voices.set(note, list);
    src.onended = () => {
      gain.disconnect();
      this.sustained.delete(v);
      const l = this.voices.get(note);
      if (l) this.voices.set(note, l.filter((x) => x !== v));
    };
  }

  /** Release the oldest held voice of `note` (first in, first out, matching scheduled note pairs). */
  noteOff(note: number, when?: number) {
    const inst = this.inst;
    const v = (this.voices.get(note) ?? []).find((x) => x.held);
    if (!v) return;
    v.held = false;
    if (inst?.drumMap) return; // one-shots ring out
    if (this.sustainPedal) this.sustained.add(v);
    else this.fade(v, inst?.release ?? 0.2, when);
  }

  setSustain(on: boolean, when?: number) {
    this.sustainPedal = on;
    if (!on) {
      for (const v of this.sustained) this.fade(v, this.inst?.release ?? 0.2, when);
      this.sustained.clear();
    }
  }

  private fade(v: Playing, seconds: number, when?: number) {
    const t = Math.max(when ?? 0, this.ctx.currentTime);
    v.held = false;
    v.gain.gain.cancelAndHoldAtTime?.(t) ?? v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, Math.max(0.01, seconds / 4));
    try {
      v.src.stop(t + seconds * 1.5 + 0.05);
    } catch {
      /* already stopped */
    }
  }

  allOff() {
    const t = this.ctx.currentTime;
    for (const list of this.voices.values()) for (const v of list) this.fade(v, 0.05, t);
    this.sustained.clear();
    this.sustainPedal = false;
  }
}

/* ---------------- General MIDI → sampled instruments ---------------- */

const PIANO = 'salamander-grand-piano';
const VIOLIN = 'vsco2-violin-section';
const CELLO = 'vsco2-cello-section';
const HORN = 'vsco2-french-horn';
const TRUMPET = 'vsco2-trumpet';
const CLARINET = 'vsco2-clarinet';
const FLUTE = 'vsco2-flute';
const ORGAN = 'vsco2-organ';
const HARP = 'vcsl-concert-harp';
const VIBES = 'vcsl-vibraphone';
const MARIMBA = 'vcsl-marimba';

/**
 * Bundled instruments for a GM program, best first. A note goes to the first one whose range covers it,
 * so e.g. low string notes fall to the cello section and high brass to the trumpet.
 */
export function candidatesForProgram(program: number): string[] {
  const exact: Record<number, string[]> = {
    11: [VIBES], 12: [MARIMBA], 13: [MARIMBA], 42: [CELLO, VIOLIN], 43: [CELLO], 46: [HARP], 47: [CELLO, MARIMBA],
    56: [TRUMPET, HORN], 57: [HORN, CELLO], 58: [HORN, CELLO], 59: [TRUMPET, HORN], 60: [HORN, TRUMPET],
    68: [CLARINET, FLUTE], 69: [CLARINET], 70: [CLARINET, CELLO], 71: [CLARINET, FLUTE],
  };
  if (exact[program]) return exact[program];
  const families: string[][] = [
    [PIANO], [VIBES, MARIMBA], [ORGAN], [HARP], [HARP, CELLO], [VIOLIN, CELLO], [VIOLIN, CELLO], [TRUMPET, HORN],
    [CLARINET, FLUTE], [FLUTE, CLARINET], [FLUTE, CLARINET], [ORGAN, VIOLIN, CELLO], [VIBES, ORGAN], [HARP], [MARIMBA], [PIANO],
  ];
  return families[program >> 3];
}

/** The primary bundled instrument for a GM program. */
export const instrumentForProgram = (program: number) => candidatesForProgram(program)[0];

/** GM percussion keys without a sample in the kit, mapped to the closest piece that has one. */
export const DRUM_FALLBACK: Record<number, number> = {
  35: 36, 39: 37, 40: 38, 48: 47, 50: 47, 52: 49, 53: 51, 55: 49, 57: 49, 59: 51, 54: 42, 56: 37, 69: 42, 70: 42, 75: 37, 76: 37, 77: 37,
};

export const DRUM_KIT = 'big-rusty-drums';
export const FALLBACK_INSTRUMENT = 'salamander-grand-piano';

/**
 * Which instrument plays a note on a channel with a given program: drums go to the kit (with fallbacks),
 * and notes outside an instrument's range fall back to the piano. Returns the note to play too.
 */
export function routeNote(insts: Map<string, Pick<Instrument, 'range' | 'notes' | 'drumMap'>>, channel: number, program: number, note: number): { id: string; note: number } | null {
  if (channel === 9) {
    const kit = insts.get(DRUM_KIT);
    if (!kit) return null;
    const n = kit.notes.includes(note) ? note : DRUM_FALLBACK[note];
    return n !== undefined && kit.notes.includes(n) ? { id: DRUM_KIT, note: n } : null;
  }
  for (const id of candidatesForProgram(program)) {
    const inst = insts.get(id);
    if (inst && playable(inst, note)) return { id, note };
  }
  const piano = insts.get(FALLBACK_INSTRUMENT);
  if (piano && playable(piano, note)) return { id: FALLBACK_INSTRUMENT, note };
  return null;
}

/** A Player sink that renders channel messages with the sampled instruments. */
export class SampledSink {
  private samplers = new Map<string, Sampler>();
  private insts: Map<string, Instrument>;
  private programs = new Array(16).fill(0);
  private volume = new Array(16).fill(100);
  private expression = new Array(16).fill(127);
  /** Which sampler and note each sounding (channel, note) went to, so note-offs follow. */
  private routed = new Map<number, { id: string; note: number }[]>();
  readonly out: GainNode;

  constructor(ctx: AudioContext, instruments: Instrument[], destination: AudioNode = ctx.destination) {
    this.insts = new Map(instruments.map((i) => [i.id, i]));
    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.out.connect(comp).connect(destination);
    for (const inst of instruments) {
      const s = new Sampler(ctx, this.out, false);
      s.inst = inst;
      this.samplers.set(inst.id, s);
    }
  }

  /** Instrument ids a list of (channel, program) pairs would use, for preloading. */
  needed(uses: { channel: number; program: number }[]): Instrument[] {
    const ids = new Set<string>();
    for (const u of uses) {
      if (u.channel === 9) ids.add(DRUM_KIT);
      else for (const id of candidatesForProgram(u.program)) ids.add(id);
    }
    if (uses.some((u) => u.channel !== 9)) ids.add(FALLBACK_INSTRUMENT);
    return [...ids].map((id) => this.insts.get(id)!).filter(Boolean);
  }

  load(insts: Instrument[], onProgress?: (done: number, total: number) => void) {
    const total = insts.reduce((n, i) => n + i.notes.length, 0);
    let done = 0;
    return Promise.all(insts.map((i) => this.samplers.get(i.id)!.load(i, () => onProgress?.(++done, total))));
  }

  send(bytes: number[], when: number) {
    const [s, d1 = 0, d2 = 0] = bytes;
    const ch = s & 0x0f;
    switch (s & 0xf0) {
      case 0x90:
        if (d2 > 0) {
          const r = routeNote(this.insts, ch, this.programs[ch], d1);
          if (!r) return;
          const key = ch * 128 + d1;
          const list = this.routed.get(key) ?? [];
          list.push(r);
          this.routed.set(key, list);
          const scale = (this.volume[ch] / 127) ** 2 * (this.expression[ch] / 127) ** 2 * 1.6;
          this.samplers.get(r.id)!.noteOn(r.note, d2, when, Math.min(1.2, scale), { ignoreRange: true });
          return;
        }
      // falls through
      case 0x80: {
        const r = this.routed.get(ch * 128 + d1)?.shift();
        if (r) this.samplers.get(r.id)!.noteOff(r.note, when);
        return;
      }
      case 0xc0:
        this.programs[ch] = d1;
        return;
      case 0xb0:
        if (d1 === 7) this.volume[ch] = d2;
        else if (d1 === 11) this.expression[ch] = d2;
        else if (d1 === 64) {
          // The pedal applies to every instrument this channel might be using.
          const ids = new Set([...candidatesForProgram(this.programs[ch]), FALLBACK_INSTRUMENT]);
          for (const id of ids) this.samplers.get(id)?.setSustain(d2 >= 64, when);
        } else if (d1 === 120 || d1 === 123) this.panic();
        else if (d1 === 121) this.expression[ch] = 127;
    }
  }

  panic() {
    for (const s of this.samplers.values()) s.allOff();
    this.routed.clear();
  }

  reset() {
    this.panic();
    this.programs.fill(0);
    this.volume.fill(100);
    this.expression.fill(127);
  }
}
