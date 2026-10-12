/**
 * Standard MIDI File reader and writer. Dependency-free; runs in the browser and in Node.
 *
 * The reader is deliberately forgiving, like a good player: it unwraps RIFF RMID files, skips
 * unknown chunks, tolerates truncated tracks and missing End of Track events, and reports each
 * problem as a warning instead of throwing. It only throws when there is no MThd header at all.
 */
import { GM_PROGRAMS, ccName, noteName } from './midi.ts';

export interface SmfHeader {
  format: number;
  /** Track count declared in the header (may differ from the number of MTrk chunks found). */
  declaredTracks: number;
  /** Raw 16-bit division word. */
  division: number;
  /** Ticks per quarter note, when division is metrical. */
  ppq?: number;
  /** SMPTE frames per second (24, 25, 29.97, 30) and ticks per frame, when division is timecode. */
  smpte?: { fps: number; ticksPerFrame: number };
}

export type SmfEvent =
  | ({ kind: 'channel' } & ChannelEvent)
  | ({ kind: 'meta' } & MetaEvent)
  | ({ kind: 'sysex' } & SysexEvent);

interface EventBase {
  /** Absolute tick from the start of its track. */
  tick: number;
  delta: number;
  track: number;
  /** Byte offset of the event (its delta-time) in the file. */
  offset: number;
  /** Number of bytes the delta-time takes; the event itself starts at offset + deltaLength. */
  deltaLength: number;
  /** Total bytes in the file for this event, delta-time included (running status means no status byte). */
  length: number;
  /** Raw event bytes as stored (without the delta-time; includes the status byte even under running status). */
  bytes: number[];
}

export interface ChannelEvent extends EventBase {
  status: number;
  /** 0–15 */
  channel: number;
  type: 'noteOff' | 'noteOn' | 'polyPressure' | 'controlChange' | 'programChange' | 'channelPressure' | 'pitchBend';
  data1: number;
  data2?: number;
  runningStatus: boolean;
}

export interface MetaEvent extends EventBase {
  metaType: number;
  data: number[];
}

export interface SysexEvent extends EventBase {
  /** F0 for a normal SysEx event, F7 for an escape/continuation packet. */
  status: 0xf0 | 0xf7;
  data: number[];
}

export interface SmfTrack {
  index: number;
  name?: string;
  /** Length declared in the MTrk chunk header. */
  length: number;
  offset: number;
  events: SmfEvent[];
  /** Tick of the last event (End of Track if present). */
  endTick: number;
}

export interface SmfFile {
  header: SmfHeader;
  /** Byte offset of the MThd chunk and its declared data length. */
  headerOffset: number;
  headerLength: number;
  tracks: SmfTrack[];
  /** Chunks other than MThd/MTrk, e.g. vendor extensions. */
  otherChunks: { id: string; length: number; offset: number }[];
  warnings: string[];
  byteLength: number;
  /** True if the file was wrapped in a RIFF RMID container. */
  rmid: boolean;
}

const META_NAMES: Record<number, string> = {
  0x00: 'Sequence Number', 0x01: 'Text', 0x02: 'Copyright', 0x03: 'Track Name', 0x04: 'Instrument Name',
  0x05: 'Lyric', 0x06: 'Marker', 0x07: 'Cue Point', 0x08: 'Program Name', 0x09: 'Device Name',
  0x20: 'Channel Prefix', 0x21: 'MIDI Port', 0x2f: 'End of Track', 0x51: 'Set Tempo', 0x54: 'SMPTE Offset',
  0x58: 'Time Signature', 0x59: 'Key Signature', 0x7f: 'Sequencer Specific',
};

export const metaName = (t: number) => META_NAMES[t] ?? (t >= 0x01 && t <= 0x0f ? 'Text (other)' : `Unknown meta ${t.toString(16).toUpperCase().padStart(2, '0')}`);

const CHANNEL_TYPES = ['noteOff', 'noteOn', 'polyPressure', 'controlChange', 'programChange', 'channelPressure', 'pitchBend'] as const;

const ascii = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32le = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Decode meta-event text: UTF-8 when valid, otherwise Latin-1 (what most older files use). */
export function decodeText(data: ArrayLike<number>): string {
  const bytes = Uint8Array.from(data as ArrayLike<number>);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return Array.from(bytes, (c) => String.fromCharCode(c)).join('');
  }
}

/** If `bytes` is a RIFF RMID file, return the offset and length of its embedded SMF. */
function unwrapRmid(b: Uint8Array): { start: number; end: number } | null {
  if (b.length < 12 || ascii(b, 0) !== 'RIFF' || ascii(b, 8) !== 'RMID') return null;
  let p = 12;
  while (p + 8 <= b.length) {
    const id = ascii(b, p);
    const len = u32le(b, p + 4);
    if (id === 'data') return { start: p + 8, end: Math.min(b.length, p + 8 + len) };
    p += 8 + len + (len & 1);
  }
  return null;
}

export function parseSmf(input: ArrayBuffer | Uint8Array): SmfFile {
  let b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const byteLength = b.length;
  const warnings: string[] = [];
  const rmid = unwrapRmid(b);
  let base = 0;
  if (rmid) {
    base = rmid.start;
    b = b.subarray(rmid.start, rmid.end);
  }

  // Find MThd; some files have junk (e.g. a MacBinary header) in front.
  let p = 0;
  if (b.length < 14 || ascii(b, 0) !== 'MThd') {
    let found = -1;
    for (let i = 0; i + 4 <= Math.min(b.length, 4096); i++) {
      if (b[i] === 0x4d && ascii(b, i) === 'MThd') { found = i; break; }
    }
    if (found < 0) throw new Error('Not a Standard MIDI File: no "MThd" header found.');
    warnings.push(`Skipped ${found} byte${found === 1 ? '' : 's'} before the MThd header.`);
    p = found;
  }
  const headerAt = p;
  const hlen = u32(b, p + 4);
  if (hlen < 6) throw new Error(`MThd header is ${hlen} bytes long; expected 6.`);
  if (hlen > 6) warnings.push(`MThd header is ${hlen} bytes long; extra bytes ignored.`);
  const format = u16(b, p + 8);
  const declaredTracks = u16(b, p + 10);
  const division = u16(b, p + 12);
  const header: SmfHeader = { format, declaredTracks, division };
  if (division & 0x8000) {
    const fpsByte = (division >> 8) & 0xff;
    const fpsRaw = 256 - fpsByte; // two's complement negative
    const fps = fpsRaw === 29 ? 29.97 : fpsRaw;
    if (![24, 25, 29, 30].includes(fpsRaw)) warnings.push(`Unusual SMPTE frame rate ${fpsRaw}.`);
    header.smpte = { fps, ticksPerFrame: division & 0xff || 1 };
  } else {
    header.ppq = division || 1;
    if (!division) warnings.push('Division is 0 ticks per quarter note; using 1.');
  }
  if (format > 2) warnings.push(`Unknown format ${format}; reading tracks anyway.`);
  p += 8 + hlen;

  const tracks: SmfTrack[] = [];
  const otherChunks: SmfFile['otherChunks'] = [];
  while (p + 8 <= b.length) {
    const id = ascii(b, p);
    let len = u32(b, p + 4);
    const start = p + 8;
    if (!/^[\x20-\x7e]{4}$/.test(id)) {
      warnings.push(`Garbage at byte ${base + p} after the last chunk; ignored ${b.length - p} trailing bytes.`);
      break;
    }
    if (start + len > b.length) {
      warnings.push(`Chunk "${id}" at byte ${base + p} claims ${len} bytes but only ${b.length - start} remain; truncated.`);
      len = b.length - start;
    }
    if (id === 'MTrk') tracks.push(parseTrack(b, start, len, tracks.length, base, warnings));
    else otherChunks.push({ id, length: len, offset: base + p });
    p = start + len;
  }
  if (p < b.length && p + 8 > b.length) warnings.push(`${b.length - p} trailing byte${b.length - p === 1 ? '' : 's'} after the last chunk.`);
  if (tracks.length !== declaredTracks) warnings.push(`Header declares ${declaredTracks} track${declaredTracks === 1 ? '' : 's'} but ${tracks.length} MTrk chunk${tracks.length === 1 ? ' was' : 's were'} found.`);
  if (format === 0 && tracks.length > 1) warnings.push('Format 0 files should contain exactly one track.');
  return { header, headerOffset: base + headerAt, headerLength: hlen, tracks, otherChunks, warnings, byteLength, rmid: Boolean(rmid) };
}

function parseTrack(b: Uint8Array, start: number, len: number, index: number, base: number, warnings: string[]): SmfTrack {
  const end = start + len;
  const events: SmfEvent[] = [];
  let p = start;
  let tick = 0;
  let running: number | undefined;
  let sawEnd = false;
  const where = () => `track ${index + 1}, byte ${base + p}`;

  const readVlq = (): number | null => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      if (p >= end) return null;
      const c = b[p++];
      v = (v << 7) | (c & 0x7f);
      if (!(c & 0x80)) return v >>> 0;
    }
    return null;
  };

  while (p < end) {
    const offset = base + p;
    const delta = readVlq();
    if (delta === null) {
      warnings.push(`Bad or truncated delta-time in ${where()}.`);
      break;
    }
    tick += delta;
    if (p >= end) {
      warnings.push(`Track ${index + 1} ends after a delta-time with no event.`);
      break;
    }
    let status = b[p];
    const evStart = p;
    if (status === 0xff) {
      p++;
      const metaType = b[p++];
      const mlen = readVlq();
      if (mlen === null || metaType === undefined || p + mlen > end) {
        warnings.push(`Truncated meta event in ${where()}.`);
        break;
      }
      const data = Array.from(b.subarray(p, p + mlen));
      p += mlen;
      events.push({ kind: 'meta', tick, delta, track: index, offset, deltaLength: evStart - (offset - base), length: p - (offset - base), metaType, data, bytes: Array.from(b.subarray(evStart, p)) });
      if (metaType === 0x2f) {
        sawEnd = true;
        if (p < end) warnings.push(`Track ${index + 1} has ${end - p} byte${end - p === 1 ? '' : 's'} after End of Track; ignored.`);
        break;
      }
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      p++;
      const slen = readVlq();
      if (slen === null || p + slen > end) {
        warnings.push(`Truncated SysEx event in ${where()}.`);
        break;
      }
      const data = Array.from(b.subarray(p, p + slen));
      p += slen;
      events.push({ kind: 'sysex', tick, delta, track: index, offset, deltaLength: evStart - (offset - base), length: p - (offset - base), status, data, bytes: Array.from(b.subarray(evStart, p)) });
      running = undefined;
      continue;
    }
    let usedRunning = false;
    if (status < 0x80) {
      if (running === undefined) {
        warnings.push(`Data byte ${status.toString(16).toUpperCase().padStart(2, '0')} without a status byte in ${where()}; skipped.`);
        p++;
        continue;
      }
      status = running;
      usedRunning = true;
    } else {
      p++;
      if (status >= 0xf0) {
        // System common / real-time bytes are not valid in an SMF. Skip them and their data bytes.
        warnings.push(`Unexpected status ${status.toString(16).toUpperCase()} in ${where()}; skipped.`);
        while (p < end && b[p] < 0x80) p++;
        continue;
      }
      running = status;
    }
    const hi = status >> 4;
    const need = hi === 0xc || hi === 0xd ? 1 : 2;
    if (p + need > end) {
      warnings.push(`Truncated channel message in ${where()}.`);
      break;
    }
    const data1 = b[p++];
    const data2 = need === 2 ? b[p++] : undefined;
    if (data1 > 0x7f || (data2 !== undefined && data2 > 0x7f)) warnings.push(`Data byte ≥ 0x80 in a channel message in ${where()}.`);
    events.push({
      kind: 'channel', tick, delta, track: index, offset, deltaLength: evStart - (offset - base), length: p - (offset - base), status, channel: status & 0x0f, type: CHANNEL_TYPES[hi - 8],
      data1, data2, runningStatus: usedRunning,
      bytes: usedRunning ? [status, ...Array.from(b.subarray(evStart, p))] : Array.from(b.subarray(evStart, p)),
    });
  }
  if (!sawEnd) warnings.push(`Track ${index + 1} has no End of Track event.`);
  const nameEv = events.find((e) => e.kind === 'meta' && e.metaType === 0x03);
  return {
    index,
    name: nameEv && nameEv.kind === 'meta' ? decodeText(nameEv.data).trim() || undefined : undefined,
    length: len,
    offset: base + start - 8,
    events,
    endTick: tick,
  };
}

/* ---------------- Timing ---------------- */

export interface TempoPoint {
  tick: number;
  /** Microseconds per quarter note. */
  usPerQuarter: number;
  bpm: number;
  /** Seconds from the start of the file at this tick. */
  seconds: number;
}

export interface TempoMap {
  points: TempoPoint[];
  tickToSeconds(tick: number): number;
  secondsToTick(seconds: number): number;
}

/** Build a tempo map from every Set Tempo event in the file (format 0/1 conventionally put them in track 1). */
export function buildTempoMap(smf: SmfFile): TempoMap {
  const { ppq, smpte } = smf.header;
  if (smpte) {
    const perTick = 1 / (smpte.fps * smpte.ticksPerFrame);
    return {
      points: [],
      tickToSeconds: (t) => t * perTick,
      secondsToTick: (s) => s / perTick,
    };
  }
  const q = ppq ?? 480;
  const raw: { tick: number; us: number }[] = [];
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind === 'meta' && e.metaType === 0x51 && e.data.length >= 3) {
        const us = (e.data[0] << 16) | (e.data[1] << 8) | e.data[2];
        if (us > 0) raw.push({ tick: e.tick, us });
      }
    }
    if (smf.header.format === 2) break; // format 2: each track has its own tempo; use the first
  }
  raw.sort((a, b) => a.tick - b.tick);
  const points: TempoPoint[] = [];
  let seconds = 0;
  let prevTick = 0;
  let prevUs = 500_000;
  if (!raw.length || raw[0].tick > 0) points.push({ tick: 0, usPerQuarter: prevUs, bpm: 120, seconds: 0 });
  for (const r of raw) {
    seconds += ((r.tick - prevTick) * prevUs) / q / 1e6;
    const point = { tick: r.tick, usPerQuarter: r.us, bpm: 60e6 / r.us, seconds };
    // Several tempo events at the same tick: the last one wins.
    if (points.length && points[points.length - 1].tick === r.tick) points[points.length - 1] = point;
    else points.push(point);
    prevTick = r.tick;
    prevUs = r.us;
  }
  const find = (pred: (p: TempoPoint) => boolean) => {
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pred(points[mid])) lo = mid;
      else hi = mid - 1;
    }
    return points[lo];
  };
  return {
    points,
    tickToSeconds(tick) {
      const p = find((x) => x.tick <= tick);
      return p.seconds + ((tick - p.tick) * p.usPerQuarter) / q / 1e6;
    },
    secondsToTick(s) {
      const p = find((x) => x.seconds <= s);
      return p.tick + ((s - p.seconds) * 1e6 * q) / p.usPerQuarter;
    },
  };
}

export interface TimeSignature {
  tick: number;
  numerator: number;
  denominator: number;
  clocksPerClick: number;
  thirtySecondsPerQuarter: number;
}

export interface KeySignature {
  tick: number;
  /** -7 (7 flats) to +7 (7 sharps) */
  sharps: number;
  minor: boolean;
  name: string;
}

const MAJOR_KEYS = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
const MINOR_KEYS = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];

export function keyName(sharps: number, minor: boolean): string {
  const k = (minor ? MINOR_KEYS : MAJOR_KEYS)[sharps + 7];
  return k ? `${k} ${minor ? 'minor' : 'major'}` : `${sharps} sharps (invalid)`;
}

export function signatures(smf: SmfFile) {
  const time: TimeSignature[] = [];
  const key: KeySignature[] = [];
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind !== 'meta') continue;
      if (e.metaType === 0x58 && e.data.length >= 4) {
        time.push({ tick: e.tick, numerator: e.data[0], denominator: 2 ** e.data[1], clocksPerClick: e.data[2], thirtySecondsPerQuarter: e.data[3] });
      } else if (e.metaType === 0x59 && e.data.length >= 2) {
        const sharps = e.data[0] > 127 ? e.data[0] - 256 : e.data[0];
        const minor = e.data[1] === 1;
        key.push({ tick: e.tick, sharps, minor, name: keyName(sharps, minor) });
      }
    }
  }
  time.sort((a, b) => a.tick - b.tick);
  key.sort((a, b) => a.tick - b.tick);
  return { time, key };
}

/** Format a tick as bar:beat:tick using the file's time signatures (bars and beats count from 1). */
export function barBeat(tick: number, ppq: number, time: TimeSignature[]): string {
  let bar = 1;
  let at = 0;
  let num = 4;
  let den = 4;
  for (const ts of time) {
    if (ts.tick > tick) break;
    const ticksPerBar = (ppq * 4 * num) / den;
    bar += Math.floor((ts.tick - at) / ticksPerBar);
    at = ts.tick;
    num = ts.numerator;
    den = ts.denominator;
  }
  const ticksPerBeat = (ppq * 4) / den;
  const ticksPerBar = ticksPerBeat * num;
  const into = tick - at;
  bar += Math.floor(into / ticksPerBar);
  const inBar = into % ticksPerBar;
  const beat = Math.floor(inBar / ticksPerBeat) + 1;
  return `${bar}:${beat}:${Math.round(inBar % ticksPerBeat)}`;
}

/* ---------------- Notes ---------------- */

export interface Note {
  track: number;
  channel: number;
  pitch: number;
  velocity: number;
  startTick: number;
  endTick: number;
  start: number;
  end: number;
  /** GM program active on this channel when the note started. */
  program: number;
}

/**
 * Pair Note On / Note Off events into notes. Overlapping notes of the same pitch on the same channel
 * are matched first-in, first-out; notes still held at the end of a track end there.
 */
export function extractNotes(smf: SmfFile, tempo = buildTempoMap(smf)): Note[] {
  const notes: Note[] = [];
  for (const t of smf.tracks) {
    const open = new Map<number, { tick: number; vel: number; program: number }[]>();
    const programs = new Array(16).fill(0);
    for (const e of t.events) {
      if (e.kind !== 'channel') continue;
      if (e.type === 'programChange') programs[e.channel] = e.data1;
      const isOn = e.type === 'noteOn' && (e.data2 ?? 0) > 0;
      const isOff = e.type === 'noteOff' || (e.type === 'noteOn' && e.data2 === 0);
      const key = e.channel * 128 + e.data1;
      if (isOn) {
        let list = open.get(key);
        if (!list) open.set(key, (list = []));
        list.push({ tick: e.tick, vel: e.data2 ?? 0, program: programs[e.channel] });
      } else if (isOff) {
        const on = open.get(key)?.shift();
        if (on) notes.push(makeNote(t.index, e.channel, e.data1, on, e.tick, tempo));
      }
    }
    for (const [key, list] of open) {
      for (const on of list) notes.push(makeNote(t.index, key >> 7, key & 127, on, Math.max(t.endTick, on.tick), tempo));
    }
  }
  notes.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
  return notes;
}

function makeNote(track: number, channel: number, pitch: number, on: { tick: number; vel: number; program: number }, endTick: number, tempo: TempoMap): Note {
  return {
    track, channel, pitch, velocity: on.vel, startTick: on.tick, endTick, program: on.program,
    start: tempo.tickToSeconds(on.tick), end: tempo.tickToSeconds(endTick),
  };
}

/* ---------------- Describing events ---------------- */

const h2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

/** Human-readable name and details for an event, for tables. */
export function describeEvent(e: SmfEvent): { name: string; detail: string } {
  if (e.kind === 'meta') {
    const name = metaName(e.metaType);
    const d = e.data;
    switch (e.metaType) {
      case 0x00: return { name, detail: d.length >= 2 ? String((d[0] << 8) | d[1]) : '(this track)' };
      case 0x20: return { name, detail: `channel ${(d[0] ?? 0) + 1}` };
      case 0x21: return { name, detail: `port ${d[0] ?? 0}` };
      case 0x2f: return { name, detail: '' };
      case 0x51: {
        const us = (d[0] << 16) | (d[1] << 8) | d[2];
        return { name, detail: `${us} µs/quarter = ${(60e6 / us).toFixed(2).replace(/\.?0+$/, '')} BPM` };
      }
      case 0x54: return { name, detail: `${d[0] & 0x1f}h ${d[1]}m ${d[2]}s ${d[3]}f ${d[4]}ff` };
      case 0x58: return { name, detail: `${d[0]}/${2 ** d[1]} · ${d[2]} clocks/click · ${d[3]} 32nds/quarter` };
      case 0x59: {
        const sf = d[0] > 127 ? d[0] - 256 : d[0];
        return { name, detail: keyName(sf, d[1] === 1) };
      }
      case 0x7f: return { name, detail: `${d.length} bytes${d.length ? ` · ID ${d[0] === 0 ? d.slice(0, 3).map(h2).join(' ') : h2(d[0])}` : ''}` };
      default:
        if (e.metaType >= 0x01 && e.metaType <= 0x0f) return { name, detail: `“${decodeText(d)}”` };
        return { name, detail: `${d.length} bytes` };
    }
  }
  if (e.kind === 'sysex') {
    return { name: e.status === 0xf0 ? 'SysEx' : 'SysEx (escape)', detail: `${e.data.length} bytes: ${(e.status === 0xf0 ? [0xf0, ...e.data] : e.data).slice(0, 12).map(h2).join(' ')}${e.data.length > 12 ? ' …' : ''}` };
  }
  const ch = e.channel;
  switch (e.type) {
    case 'noteOn':
      return e.data2 === 0
        ? { name: 'Note Off (vel 0)', detail: `${noteName(e.data1)} (${e.data1})` }
        : { name: 'Note On', detail: `${noteName(e.data1)} (${e.data1}) vel ${e.data2}` };
    case 'noteOff': return { name: 'Note Off', detail: `${noteName(e.data1)} (${e.data1}) vel ${e.data2}` };
    case 'polyPressure': return { name: 'Poly Pressure', detail: `${noteName(e.data1)} = ${e.data2}` };
    case 'controlChange': return { name: e.data1 >= 120 ? 'Channel Mode' : 'Control Change', detail: `CC ${e.data1} ${ccName(e.data1)} = ${e.data2}` };
    case 'programChange': return { name: 'Program Change', detail: `${e.data1 + 1}${ch === 9 ? ' (drum kit)' : ` · ${GM_PROGRAMS[e.data1]}`}` };
    case 'channelPressure': return { name: 'Channel Pressure', detail: String(e.data1) };
    case 'pitchBend': {
      const v = ((e.data2 ?? 0) << 7) | e.data1;
      return { name: 'Pitch Bend', detail: `${v - 8192 >= 0 ? '+' : ''}${v - 8192}` };
    }
  }
}

/* ---------------- Writing ---------------- */

export interface WriteEvent {
  delta: number;
  /** Event bytes without the delta: channel message, FF meta (type, len, data) or F0 sysex (len, data). */
  bytes: number[];
}

/** Encode a VLQ (local copy so the writer has no dependency on midi.ts error handling). */
function vlq(value: number): number[] {
  const out = [value & 0x7f];
  value >>>= 7;
  while (value > 0) {
    out.unshift((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return out;
}

/** Build a meta event's bytes: FF type len data. */
export const meta = (type: number, data: number[]) => [0xff, type, ...vlq(data.length), ...data];
export const textMeta = (type: number, text: string) => meta(type, Array.from(new TextEncoder().encode(text)));
export const tempoMeta = (bpm: number) => {
  const us = Math.round(60e6 / bpm);
  return meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);
};

/** Write a Standard MIDI File. An End of Track event is appended to any track that lacks one. */
export function writeSmf(opts: { format?: 0 | 1 | 2; ppq?: number; tracks: WriteEvent[][]; runningStatus?: boolean }): Uint8Array {
  const { format = 1, ppq = 480, tracks, runningStatus = false } = opts;
  const out: number[] = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, (tracks.length >> 8) & 0xff, tracks.length & 0xff, (ppq >> 8) & 0x7f, ppq & 0xff];
  for (const events of tracks) {
    const body: number[] = [];
    let last: number | undefined;
    for (const e of events) {
      body.push(...vlq(e.delta));
      const s = e.bytes[0];
      if (runningStatus && s >= 0x80 && s < 0xf0 && s === last) body.push(...e.bytes.slice(1));
      else body.push(...e.bytes);
      last = s < 0xf0 ? s : undefined;
    }
    const lastEv = events[events.length - 1];
    if (!lastEv || lastEv.bytes[0] !== 0xff || lastEv.bytes[1] !== 0x2f) body.push(0, 0xff, 0x2f, 0);
    const n = body.length;
    out.push(0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, ...body);
  }
  return Uint8Array.from(out);
}

/** Convert absolute-tick events to delta-time events, sorted stably by tick. */
export function toDeltas(events: { tick: number; bytes: number[] }[]): WriteEvent[] {
  const sorted = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.tick - b.tick || a.i - b.i);
  let prev = 0;
  return sorted.map((e) => {
    const delta = e.tick - prev;
    prev = e.tick;
    return { delta, bytes: e.bytes };
  });
}

/**
 * A short demo file: the opening of the Prelude in C major from Bach's Well-Tempered Clavier
 * (public domain), arranged on three tracks with a tempo track, a ritardando, and a drum pattern
 * so every part of the inspector has something to show.
 */
export function demoSmf(): Uint8Array {
  const ppq = 480;
  const bars = [
    [60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76],
    [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72],
  ];
  const sixteenth = ppq / 4;
  const conductor = [
    { tick: 0, bytes: textMeta(0x03, 'Conductor') },
    { tick: 0, bytes: textMeta(0x02, 'Public domain (J. S. Bach, BWV 846)') },
    { tick: 0, bytes: meta(0x58, [4, 2, 24, 8]) },
    { tick: 0, bytes: meta(0x59, [0, 0]) },
    { tick: 0, bytes: tempoMeta(76) },
    { tick: 0, bytes: textMeta(0x06, 'Prelude') },
    { tick: ppq * 4 * 6, bytes: tempoMeta(70) },
    { tick: ppq * 4 * 7, bytes: tempoMeta(60) },
    { tick: ppq * 4 * 7, bytes: textMeta(0x06, 'Ritardando') },
  ];
  const piano: { tick: number; bytes: number[] }[] = [
    { tick: 0, bytes: textMeta(0x03, 'Piano') },
    { tick: 0, bytes: [0xc0, 0] },
    { tick: 0, bytes: [0xb0, 7, 100] },
  ];
  const bass: { tick: number; bytes: number[] }[] = [
    { tick: 0, bytes: textMeta(0x03, 'Strings') },
    { tick: 0, bytes: [0xc1, 48] },
    { tick: 0, bytes: [0xb1, 7, 70] },
  ];
  bars.forEach((chord, bar) => {
    const barTick = bar * ppq * 4;
    for (let half = 0; half < 2; half++) {
      const t0 = barTick + half * ppq * 2;
      // Two lower notes are held for the half bar, the upper arpeggio repeats.
      const pattern = [0, 1, 2, 3, 4, 2, 3, 4];
      pattern.forEach((idx, k) => {
        const t = t0 + k * sixteenth;
        const holdEnd = idx < 2 ? t0 + ppq * 2 - 10 : t + sixteenth - 10;
        piano.push({ tick: t, bytes: [0x90, chord[idx], 72 + (k === 0 ? 12 : 0)] });
        piano.push({ tick: holdEnd, bytes: [0x80, chord[idx], 64] });
      });
    }
    bass.push({ tick: barTick, bytes: [0x91, chord[0] - 12, 60] });
    bass.push({ tick: barTick + ppq * 4 - 20, bytes: [0x81, chord[0] - 12, 0] });
  });
  bass.push({ tick: 0, bytes: [0xe1, 0x00, 0x40] });
  const drums: { tick: number; bytes: number[] }[] = [{ tick: 0, bytes: textMeta(0x03, 'Brushes') }];
  for (let beat = 0; beat < 7 * 4; beat++) {
    const t = beat * ppq;
    const k = beat % 4 === 0 ? 36 : beat % 4 === 2 ? 38 : 42;
    drums.push({ tick: t, bytes: [0x99, k, beat % 4 === 0 ? 70 : 45] }, { tick: t + ppq / 2, bytes: [0x99, k, 0] });
  }
  drums.push({ tick: 7 * 4 * ppq, bytes: [0x99, 49, 60] }, { tick: 8 * 4 * ppq, bytes: [0x99, 49, 0] });
  const end = ppq * 4 * bars.length + ppq;
  const close = (evs: { tick: number; bytes: number[] }[]) => toDeltas([...evs, { tick: end, bytes: [0xff, 0x2f, 0] }]);
  return writeSmf({ format: 1, ppq, tracks: [close(conductor), close(piano), close(bass), close(drums)], runningStatus: true });
}
