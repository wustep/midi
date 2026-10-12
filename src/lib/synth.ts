/**
 * A small General MIDI-ish WebAudio synthesizer and a look-ahead player for parsed SMF events.
 * No samples: each GM family gets a simple oscillator recipe, and channel 10 gets synthesized drums.
 * It's for previewing files, not for fidelity. For real sounds, play to a Web MIDI output instead.
 */
import type { SmfFile, TempoMap } from './smf.ts';
import { buildTempoMap } from './smf.ts';

interface Voice {
  osc: OscillatorNode[];
  /** Fixed per-oscillator detune in cents (for chorus), added to the channel's pitch bend. */
  detunes: number[];
  gain: GainNode;
  note: number;
  channel: number;
  released: boolean;
  sustained: boolean;
  release: number;
}

interface Recipe {
  type: OscillatorType;
  detune?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  level: number;
}

/** One recipe per GM family of 8 programs. */
const FAMILIES: Recipe[] = [
  { type: 'triangle', attack: 0.004, decay: 1.2, sustain: 0.15, release: 0.35, cutoff: 5000, level: 0.9 }, // piano
  { type: 'sine', attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.4, cutoff: 8000, level: 0.8 }, // chromatic perc
  { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.08, cutoff: 3000, level: 0.35 }, // organ
  { type: 'sawtooth', attack: 0.003, decay: 0.8, sustain: 0.1, release: 0.25, cutoff: 2600, level: 0.5 }, // guitar
  { type: 'triangle', attack: 0.005, decay: 0.5, sustain: 0.5, release: 0.15, cutoff: 1200, level: 1 }, // bass
  { type: 'sawtooth', detune: 7, attack: 0.08, decay: 0.3, sustain: 0.8, release: 0.3, cutoff: 3500, level: 0.4 }, // strings
  { type: 'sawtooth', detune: 9, attack: 0.15, decay: 0.3, sustain: 0.85, release: 0.5, cutoff: 2500, level: 0.4 }, // ensemble
  { type: 'sawtooth', attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.12, cutoff: 2200, level: 0.45 }, // brass
  { type: 'square', attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.12, cutoff: 2000, level: 0.35 }, // reed
  { type: 'sine', attack: 0.04, decay: 0.2, sustain: 0.8, release: 0.15, cutoff: 6000, level: 0.8 }, // pipe
  { type: 'sawtooth', attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.1, cutoff: 4000, level: 0.4 }, // synth lead
  { type: 'sawtooth', detune: 12, attack: 0.3, decay: 0.5, sustain: 0.8, release: 0.8, cutoff: 1800, level: 0.35 }, // synth pad
  { type: 'square', detune: 15, attack: 0.1, decay: 0.5, sustain: 0.6, release: 0.6, cutoff: 3000, level: 0.3 }, // synth fx
  { type: 'triangle', attack: 0.003, decay: 0.7, sustain: 0.1, release: 0.3, cutoff: 4000, level: 0.8 }, // ethnic
  { type: 'sine', attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.1, cutoff: 6000, level: 0.9 }, // percussive
  { type: 'sawtooth', attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.3, cutoff: 1500, level: 0.3 }, // sound fx
];

interface ChannelState {
  program: number;
  volume: number;
  expression: number;
  pan: number;
  sustain: boolean;
  bend: number;
  bendRange: number;
  rpn: [number, number];
  out: GainNode;
  panner: StereoPannerNode;
}

export class GmSynth {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  private channels: ChannelState[];
  private voices: Voice[] = [];
  private noise: AudioBuffer;
  maxVoices = 48;

  constructor(ctx: AudioContext, destination: AudioNode = ctx.destination) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(comp).connect(destination);
    this.channels = Array.from({ length: 16 }, () => {
      const out = ctx.createGain();
      const panner = ctx.createStereoPanner();
      out.connect(panner).connect(this.master);
      return { program: 0, volume: 100, expression: 127, pan: 64, sustain: false, bend: 0, bendRange: 2, rpn: [127, 127] as [number, number], out, panner };
    });
    this.channels.forEach((c) => this.applyLevel(c, ctx.currentTime));
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private applyLevel(c: ChannelState, t: number) {
    const v = (c.volume / 127) ** 2 * (c.expression / 127) ** 2;
    c.out.gain.setTargetAtTime(v, t, 0.005);
    c.panner.pan.setTargetAtTime((c.pan - 64) / 64, t, 0.005);
  }

  /** Handle a channel message given as raw bytes (status first), at AudioContext time `t`. */
  send(bytes: number[], t = this.ctx.currentTime) {
    const [s, d1 = 0, d2 = 0] = bytes;
    const ch = s & 0x0f;
    const c = this.channels[ch];
    switch (s & 0xf0) {
      case 0x90:
        if (d2 > 0) return this.noteOn(ch, d1, d2, t);
      // falls through: Note On with velocity 0 is Note Off
      case 0x80:
        return this.noteOff(ch, d1, t);
      case 0xc0:
        c.program = d1;
        return;
      case 0xe0:
        c.bend = ((((d2 << 7) | d1) - 8192) / 8192) * c.bendRange;
        for (const v of this.voices) if (v.channel === ch) v.osc.forEach((o, k) => o.detune.setTargetAtTime(c.bend * 100 + v.detunes[k], t, 0.01));
        return;
      case 0xb0:
        switch (d1) {
          case 7: c.volume = d2; return this.applyLevel(c, t);
          case 11: c.expression = d2; return this.applyLevel(c, t);
          case 10: c.pan = d2; return this.applyLevel(c, t);
          case 64:
            c.sustain = d2 >= 64;
            if (!c.sustain) for (const v of this.voices) if (v.channel === ch && v.sustained) this.release(v, t);
            return;
          case 101: c.rpn[0] = d2; return;
          case 100: c.rpn[1] = d2; return;
          case 6: if (c.rpn[0] === 0 && c.rpn[1] === 0) c.bendRange = d2; return;
          case 120: case 123: return this.channelOff(ch, t, d1 === 120);
          case 121: c.expression = 127; c.sustain = false; c.bend = 0; return this.applyLevel(c, t);
        }
    }
  }

  noteOn(ch: number, note: number, vel: number, t = this.ctx.currentTime) {
    if (this.voices.length >= this.maxVoices) {
      const victim = this.voices.find((v) => v.released) ?? this.voices[0];
      this.kill(victim, t);
    }
    if (ch === 9) return this.drum(note, vel, t);
    const c = this.channels[ch];
    const r = FAMILIES[c.program >> 3];
    const freq = 440 * 2 ** ((note - 69) / 12);
    const amp = (vel / 127) ** 1.5 * r.level * 0.3;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(r.cutoff * (0.6 + vel / 160), 16000);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(amp, t + r.attack);
    gain.gain.setTargetAtTime(amp * r.sustain, t + r.attack, r.decay / 3);
    filter.connect(gain).connect(c.out);
    const detunes = r.detune ? [-r.detune, r.detune] : [0];
    const osc = detunes.map((det) => {
      const o = this.ctx.createOscillator();
      o.type = r.type;
      o.frequency.value = freq;
      o.detune.value = det + c.bend * 100;
      o.connect(filter);
      o.start(t);
      return o;
    });
    const voice: Voice = { osc, detunes, gain, note, channel: ch, released: false, sustained: false, release: r.release };
    osc[0].onended = () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
      gain.disconnect();
    };
    this.voices.push(voice);
  }

  noteOff(ch: number, note: number, t = this.ctx.currentTime) {
    const c = this.channels[ch];
    const v = this.voices.find((x) => x.channel === ch && x.note === note && !x.released && !x.sustained);
    if (!v) return;
    if (c.sustain) v.sustained = true;
    else this.release(v, t);
  }

  private release(v: Voice, t: number) {
    v.released = true;
    v.sustained = false;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, v.release / 4);
    for (const o of v.osc) o.stop(t + v.release * 1.5 + 0.05);
  }

  private kill(v: Voice, t: number) {
    v.released = true;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.005);
    for (const o of v.osc) o.stop(t + 0.03);
    this.voices.splice(this.voices.indexOf(v), 1);
  }

  private channelOff(ch: number, t: number, hard: boolean) {
    for (const v of [...this.voices]) if (v.channel === ch) (hard ? this.kill(v, t) : this.release(v, t));
  }

  /** Silence everything now and reset controllers. */
  panic() {
    const t = this.ctx.currentTime;
    for (const v of [...this.voices]) this.kill(v, t);
    for (const c of this.channels) {
      c.sustain = false;
      c.bend = 0;
    }
  }

  reset() {
    this.panic();
    const t = this.ctx.currentTime;
    for (const c of this.channels) {
      Object.assign(c, { program: 0, volume: 100, expression: 127, pan: 64, bendRange: 2, rpn: [127, 127] });
      this.applyLevel(c, t);
    }
  }

  private drum(note: number, vel: number, t: number) {
    const ctx = this.ctx;
    const out = this.channels[9].out;
    const amp = (vel / 127) * 0.6;
    const g = ctx.createGain();
    g.connect(out);
    const sources: AudioScheduledSourceNode[] = [];
    const env = (peak: number, decay: number) => {
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      return decay;
    };
    const tone = (from: number, to: number, decay: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + decay);
      o.connect(g);
      sources.push(o);
    };
    const noise = (type: BiquadFilterType, freq: number, q = 1) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      n.connect(f).connect(g);
      sources.push(n);
    };
    let len: number;
    if (note === 35 || note === 36) {
      tone(150, 45, 0.3);
      len = env(amp * 1.6, 0.35);
    } else if (note === 38 || note === 40 || note === 37 || note === 39) {
      noise('highpass', note === 39 ? 1200 : 1800);
      if (note !== 39) tone(220, 160, 0.1, 'triangle');
      len = env(amp, note === 37 ? 0.06 : 0.18);
    } else if (note === 42 || note === 44) {
      noise('highpass', 7000);
      len = env(amp * 0.6, 0.05);
    } else if (note === 46) {
      noise('highpass', 7000);
      len = env(amp * 0.6, 0.35);
    } else if ([49, 51, 52, 53, 55, 57, 59].includes(note)) {
      noise('highpass', note === 51 || note === 59 ? 6000 : 4500);
      len = env(amp * 0.5, note === 51 || note === 59 ? 0.6 : 1.2);
    } else if ([41, 43, 45, 47, 48, 50].includes(note)) {
      const f = 70 + (note - 41) * 14;
      tone(f * 1.6, f, 0.3);
      len = env(amp * 1.2, 0.4);
    } else {
      noise('bandpass', 400 + (note - 54) * 90, 4);
      tone(300 + note * 8, 200 + note * 6, 0.08, 'square');
      len = env(amp * 0.7, 0.12);
    }
    for (const s of sources) {
      s.start(t);
      s.stop(t + len + 0.05);
    }
    sources[0].onended = () => g.disconnect();
  }
}

/* ---------------- Player ---------------- */

export interface TimedEvent {
  time: number;
  track: number;
  bytes: number[];
  isNote: boolean;
}

/** Flatten every channel event in the file into a time-sorted list in seconds. */
export function timeline(smf: SmfFile, tempo: TempoMap = buildTempoMap(smf)): TimedEvent[] {
  const out: (TimedEvent & { tick: number; order: number })[] = [];
  let order = 0;
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind !== 'channel') continue;
      const isNote = e.type === 'noteOn' || e.type === 'noteOff';
      out.push({ time: tempo.tickToSeconds(e.tick), tick: e.tick, track: t.index, bytes: e.bytes, isNote, order: order++ });
    }
  }
  // At equal times, note-offs go before note-ons so retriggered notes are not cut.
  const rank = (e: TimedEvent) => (e.isNote ? ((e.bytes[0] & 0xf0) === 0x80 || e.bytes[2] === 0 ? 1 : 2) : 0);
  out.sort((a, b) => a.tick - b.tick || rank(a) - rank(b) || a.order - b.order);
  return out;
}

export interface Sink {
  /** Called with an AudioContext time. */
  send(bytes: number[], audioTime: number): void;
  panic(): void;
}

export class Player {
  private ctx: AudioContext;
  private events: TimedEvent[] = [];
  private cursor = 0;
  private startCtx = 0;
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  duration = 0;
  rate = 1;
  muted = new Set<number>();
  sink: Sink;
  onEnd?: () => void;

  constructor(ctx: AudioContext, sink: Sink) {
    this.ctx = ctx;
    this.sink = sink;
  }

  load(events: TimedEvent[], duration: number) {
    this.stop();
    this.events = events;
    this.duration = duration;
    this.offset = 0;
  }

  get playing() {
    return this.timer !== undefined;
  }

  /** Current position in seconds of file time. */
  get position() {
    return this.playing ? Math.min(this.duration, this.offset + Math.max(0, this.ctx.currentTime - this.startCtx) * this.rate) : this.offset;
  }

  play() {
    if (this.playing) return;
    if (this.offset >= this.duration) this.offset = 0;
    this.startCtx = this.ctx.currentTime + 0.05;
    this.cursor = this.indexAt(this.offset);
    this.chase(this.offset);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.position;
    clearInterval(this.timer);
    this.timer = undefined;
    this.sink.panic();
  }

  stop() {
    this.pause();
    this.offset = 0;
  }

  seek(seconds: number) {
    const was = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(this.duration, seconds));
    if (was) this.play();
  }

  setRate(rate: number) {
    const pos = this.position;
    const was = this.playing;
    this.pause();
    this.rate = rate;
    this.offset = pos;
    if (was) this.play();
  }

  private indexAt(seconds: number) {
    let lo = 0;
    let hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.events[mid].time < seconds) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Send the latest program, controller and bend values before `seconds`, so a seek sounds right. */
  private chase(seconds: number) {
    const latest = new Map<string, number[]>();
    for (let i = 0; i < this.events.length && this.events[i].time < seconds; i++) {
      const e = this.events[i];
      if (e.isNote) continue;
      const s = e.bytes[0];
      latest.set((s & 0xf0) === 0xb0 ? `${s}:${e.bytes[1]}` : String(s), e.bytes);
    }
    for (const b of latest.values()) this.sink.send(b, this.startCtx - 0.01);
  }

  private tick() {
    const horizon = this.ctx.currentTime + 0.2;
    while (this.cursor < this.events.length) {
      const e = this.events[this.cursor];
      const at = this.startCtx + (e.time - this.offset) / this.rate;
      if (at > horizon) break;
      this.cursor++;
      if (e.isNote && this.muted.has(e.track) && !((e.bytes[0] & 0xf0) === 0x80 || e.bytes[2] === 0)) continue;
      this.sink.send(e.bytes, Math.max(at, this.ctx.currentTime));
    }
    if (this.cursor >= this.events.length && this.position >= this.duration) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.offset = this.duration;
      this.onEnd?.();
    }
  }
}

/** A sink that forwards to a Web MIDI output, converting AudioContext time to DOMHighResTimeStamp. */
export function midiOutputSink(ctx: AudioContext, output: MIDIOutput): Sink {
  return {
    send(bytes, audioTime) {
      const ts = performance.now() + Math.max(0, audioTime - ctx.currentTime) * 1000;
      try {
        output.send(bytes, ts);
      } catch {
        /* port went away */
      }
    },
    panic() {
      (output as MIDIOutput & { clear?: () => void }).clear?.();
      for (let ch = 0; ch < 16; ch++) {
        output.send([0xb0 | ch, 64, 0]);
        output.send([0xb0 | ch, 123, 0]);
        output.send([0xb0 | ch, 120, 0]);
      }
    },
  };
}
