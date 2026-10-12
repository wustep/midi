/**
 * Summaries over a parsed Standard MIDI File for the MIDI Reader: per-track stats, controller usage,
 * SysEx and meta-event listings, and a per-byte role map for the annotated hex view.
 */
import { GM_PROGRAMS, ccName, decodeMessage, noteName } from './midi.ts';
import { manufacturerOf } from './sysex.ts';
import { decodeText, metaName, type Note, type SmfEvent, type SmfFile, type TempoMap } from './smf.ts';

export interface TrackStats {
  index: number;
  name?: string;
  instrumentName?: string;
  channels: number[];
  /** Program changes in the track, in order (deduplicated consecutive). */
  programs: { channel: number; program: number; name: string }[];
  notes: number;
  lowest?: number;
  highest?: number;
  /** Seconds from the first note on to the last note off. */
  firstNote?: number;
  lastNote?: number;
  events: number;
  bytes: number;
}

export function programLabel(channel: number, program: number): string {
  return channel === 9 ? `Drum kit ${program + 1}` : `${program + 1} · ${GM_PROGRAMS[program]}`;
}

export function trackStats(smf: SmfFile, notes: Note[]): TrackStats[] {
  return smf.tracks.map((t) => {
    const channels = new Set<number>();
    const programs: TrackStats['programs'] = [];
    let instrumentName: string | undefined;
    for (const e of t.events) {
      if (e.kind === 'channel') {
        channels.add(e.channel);
        if (e.type === 'programChange') {
          const last = programs[programs.length - 1];
          if (!last || last.channel !== e.channel || last.program !== e.data1) programs.push({ channel: e.channel, program: e.data1, name: programLabel(e.channel, e.data1) });
        }
      } else if (e.kind === 'meta' && e.metaType === 0x04 && instrumentName === undefined) {
        instrumentName = decodeText(e.data).trim() || undefined;
      }
    }
    const tn = notes.filter((n) => n.track === t.index);
    const pitched = tn.filter((n) => n.channel !== 9);
    let lowest: number | undefined;
    let highest: number | undefined;
    for (const n of pitched) {
      if (lowest === undefined || n.pitch < lowest) lowest = n.pitch;
      if (highest === undefined || n.pitch > highest) highest = n.pitch;
    }
    let firstNote: number | undefined;
    let lastNote: number | undefined;
    for (const n of tn) {
      if (firstNote === undefined || n.start < firstNote) firstNote = n.start;
      if (lastNote === undefined || n.end > lastNote) lastNote = n.end;
    }
    return {
      index: t.index, name: t.name, instrumentName, channels: [...channels].sort((a, b) => a - b), programs,
      notes: tn.length, lowest, highest, firstNote, lastNote, events: t.events.length, bytes: t.length,
    };
  });
}

export interface ControllerUse {
  channel: number;
  /** CC number, or 'bend' / 'pressure' / 'poly' */
  control: number | 'bend' | 'pressure' | 'poly';
  label: string;
  count: number;
  min: number;
  max: number;
}

/** Every controller, pitch bend and pressure stream per channel, with counts and value ranges. */
export function controllerUsage(smf: SmfFile): ControllerUse[] {
  const map = new Map<string, ControllerUse>();
  const add = (channel: number, control: ControllerUse['control'], label: string, value: number) => {
    const key = `${channel}:${control}`;
    const u = map.get(key);
    if (u) {
      u.count++;
      u.min = Math.min(u.min, value);
      u.max = Math.max(u.max, value);
    } else map.set(key, { channel, control, label, count: 1, min: value, max: value });
  };
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind !== 'channel') continue;
      if (e.type === 'controlChange') add(e.channel, e.data1, `CC ${e.data1} · ${ccName(e.data1)}`, e.data2 ?? 0);
      else if (e.type === 'pitchBend') add(e.channel, 'bend', 'Pitch bend', (((e.data2 ?? 0) << 7) | e.data1) - 8192);
      else if (e.type === 'channelPressure') add(e.channel, 'pressure', 'Channel pressure', e.data1);
      else if (e.type === 'polyPressure') add(e.channel, 'poly', 'Poly pressure', e.data2 ?? 0);
    }
  }
  const order = (c: ControllerUse['control']) => (typeof c === 'number' ? c : c === 'bend' ? 200 : c === 'pressure' ? 201 : 202);
  return [...map.values()].sort((a, b) => a.channel - b.channel || order(a.control) - order(b.control));
}

export interface SysexInfo {
  event: SmfEvent & { kind: 'sysex' };
  manufacturer?: string;
  manufacturerId?: number[];
  /** Name of a recognized Universal SysEx message, e.g. "General MIDI System On". */
  description?: string;
  complete: boolean;
}

export function sysexList(smf: SmfFile): SysexInfo[] {
  const out: SysexInfo[] = [];
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind !== 'sysex') continue;
      const complete = e.data[e.data.length - 1] === 0xf7;
      if (e.status === 0xf7) {
        out.push({ event: e, complete, description: 'Escape / continuation packet (raw bytes sent as-is)' });
        continue;
      }
      const m = manufacturerOf(e.data);
      const decoded = decodeMessage([0xf0, ...e.data]);
      const desc = decoded.summary.startsWith('Universal SysEx: ') ? decoded.summary.slice(17) : roland(e.data) ?? yamaha(e.data);
      out.push({ event: e, manufacturer: m?.name, manufacturerId: m?.id, description: desc, complete });
    }
  }
  return out.sort((a, b) => a.event.tick - b.event.tick);
}

/** Recognize a few well-known GS / XG messages. */
function roland(d: number[]): string | undefined {
  if (d[0] !== 0x41 || d[3] !== 0x12) return;
  const addr = d.slice(4, 7).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  if (d[2] === 0x42 && addr === '40 00 7f') return 'Roland GS Reset (DT1)';
  if (d[2] === 0x42 && addr === '40 00 04') return `Roland GS Master Volume = ${d[7]} (DT1)`;
  return `Roland DT1 (data set) to model ${d[2].toString(16).toUpperCase().padStart(2, '0')}, address ${addr.toUpperCase()}`;
}
function yamaha(d: number[]): string | undefined {
  if (d[0] !== 0x43 || (d[1] & 0xf0) !== 0x10) return;
  if (d[2] === 0x4c && d[3] === 0 && d[4] === 0 && d[5] === 0x7e && d[6] === 0) return 'Yamaha XG System On';
  return d[2] === 0x4c ? 'Yamaha XG parameter change' : undefined;
}

export interface MetaSummary {
  type: number;
  name: string;
  count: number;
}

export function metaSummary(smf: SmfFile): MetaSummary[] {
  const counts = new Map<number, number>();
  for (const t of smf.tracks) for (const e of t.events) if (e.kind === 'meta') counts.set(e.metaType, (counts.get(e.metaType) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([type, count]) => ({ type, name: metaName(type), count }));
}

/** Text-like meta events (text, copyright, names, lyrics, markers, cues) in time order. */
export function textEvents(smf: SmfFile) {
  const out: { event: SmfEvent; name: string; text: string }[] = [];
  for (const t of smf.tracks) {
    for (const e of t.events) {
      if (e.kind === 'meta' && e.metaType >= 0x01 && e.metaType <= 0x0f) out.push({ event: e, name: metaName(e.metaType), text: decodeText(e.data) });
    }
  }
  return out.sort((a, b) => a.event.tick - b.event.tick);
}

/* ---------------- Byte roles for the hex view ---------------- */

export const Role = {
  None: 0,
  ChunkId: 1,
  ChunkLength: 2,
  HeaderField: 3,
  Delta: 4,
  Status: 5,
  Data: 6,
  MetaHead: 7,
  MetaData: 8,
  SysexHead: 9,
  SysexData: 10,
} as const;

/** A role per byte of the original file, plus a sorted index of event start offsets for byte → event lookup. */
export function byteRoles(smf: SmfFile): { roles: Uint8Array; starts: number[]; events: SmfEvent[] } {
  const roles = new Uint8Array(smf.byteLength);
  const fill = (from: number, to: number, r: number) => roles.fill(r, Math.max(0, from), Math.min(roles.length, to));
  const h = smf.headerOffset;
  fill(h, h + 4, Role.ChunkId);
  fill(h + 4, h + 8, Role.ChunkLength);
  fill(h + 8, h + 8 + smf.headerLength, Role.HeaderField);
  const events: SmfEvent[] = [];
  for (const t of smf.tracks) {
    fill(t.offset, t.offset + 4, Role.ChunkId);
    fill(t.offset + 4, t.offset + 8, Role.ChunkLength);
    for (const e of t.events) {
      events.push(e);
      const start = e.offset + e.deltaLength;
      const end = e.offset + e.length;
      fill(e.offset, start, Role.Delta);
      if (e.kind === 'channel') {
        if (!e.runningStatus) fill(start, start + 1, Role.Status);
        fill(start + (e.runningStatus ? 0 : 1), end, Role.Data);
      } else {
        const head = end - e.data.length;
        fill(start, head, e.kind === 'meta' ? Role.MetaHead : Role.SysexHead);
        fill(head, end, e.kind === 'meta' ? Role.MetaData : Role.SysexData);
      }
    }
  }
  for (const c of smf.otherChunks) {
    fill(c.offset, c.offset + 4, Role.ChunkId);
    fill(c.offset + 4, c.offset + 8, Role.ChunkLength);
  }
  events.sort((a, b) => a.offset - b.offset);
  return { roles, starts: events.map((e) => e.offset), events };
}

/** The event whose bytes contain `offset`, or undefined (e.g. for chunk headers). */
export function eventAt(index: { starts: number[]; events: SmfEvent[] }, offset: number): SmfEvent | undefined {
  let lo = 0;
  let hi = index.starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index.starts[mid] <= offset) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const e = index.events[found];
  return e && offset < e.offset + e.length ? e : undefined;
}

/* ---------------- Byte-level explanations ---------------- */

export interface Annotation {
  /** Absolute file offsets [start, end). */
  start: number;
  end: number;
  label: string;
  detail: string;
}

const hx = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** Explain each byte group of an event: delta-time, status (or running status), data bytes, meta/SysEx length. */
export function annotateEvent(e: SmfEvent, file: Uint8Array): Annotation[] {
  const out: Annotation[] = [];
  const s = e.offset + e.deltaLength;
  const end = e.offset + e.length;
  out.push({ start: e.offset, end: s, label: 'Delta-time', detail: `${e.delta} tick${e.delta === 1 ? '' : 's'} after the previous event (variable-length quantity, ${e.deltaLength} byte${e.deltaLength === 1 ? '' : 's'})` });
  if (e.kind === 'channel') {
    const kind = { noteOff: 'Note Off', noteOn: 'Note On', polyPressure: 'Poly Pressure', controlChange: 'Control Change', programChange: 'Program Change', channelPressure: 'Channel Pressure', pitchBend: 'Pitch Bend' }[e.type];
    let p = s;
    if (e.runningStatus) out.push({ start: s, end: s, label: 'Running status', detail: `No status byte: reuses ${hx([e.status])} (${kind}, channel ${e.channel + 1}) from the previous event` });
    else out.push({ start: p, end: ++p, label: 'Status', detail: `${hx([e.status])} = ${kind} (high nibble ${hx([e.status >> 4])[1]}) on channel ${e.channel + 1} (low nibble ${(e.channel).toString(16).toUpperCase()})` });
    const d1 = e.data1;
    const d2 = e.data2;
    switch (e.type) {
      case 'noteOn':
      case 'noteOff':
      case 'polyPressure':
        out.push({ start: p, end: ++p, label: 'Note', detail: `${d1} = ${noteName(d1)}` });
        out.push({ start: p, end: ++p, label: e.type === 'polyPressure' ? 'Pressure' : 'Velocity', detail: e.type === 'noteOn' && d2 === 0 ? '0: a Note On with velocity 0 means Note Off' : String(d2) });
        break;
      case 'controlChange':
        out.push({ start: p, end: ++p, label: 'Controller', detail: `${d1} = ${ccName(d1)}` });
        out.push({ start: p, end: ++p, label: 'Value', detail: String(d2) });
        break;
      case 'programChange':
        out.push({ start: p, end: ++p, label: 'Program', detail: `${d1} on the wire = ${programLabel(e.channel, d1)}` });
        break;
      case 'channelPressure':
        out.push({ start: p, end: ++p, label: 'Pressure', detail: String(d1) });
        break;
      case 'pitchBend': {
        const v = ((d2 ?? 0) << 7) | d1;
        out.push({ start: p, end: p + 2, label: 'Bend (LSB, MSB)', detail: `${d1} + ${d2} × 128 = ${v}; ${v - 8192 >= 0 ? '+' : ''}${v - 8192} from center (${(((v - 8192) / 8192) * 2).toFixed(2)} semitones at the default ±2 range)` });
        break;
      }
    }
    return out;
  }
  const head = end - e.data.length;
  if (e.kind === 'meta') {
    out.push({ start: s, end: s + 1, label: 'Meta event', detail: 'FF marks a meta event (file-only, never sent to devices)' });
    out.push({ start: s + 1, end: s + 2, label: 'Type', detail: `${hx([e.metaType])} = ${metaName(e.metaType)}` });
    out.push({ start: s + 2, end: head, label: 'Length', detail: `${e.data.length} byte${e.data.length === 1 ? '' : 's'} (variable-length quantity)` });
  } else {
    out.push({ start: s, end: s + 1, label: e.status === 0xf0 ? 'SysEx' : 'SysEx escape', detail: e.status === 0xf0 ? 'F0 starts a System Exclusive message; the F0 is sent, followed by the data' : 'F7 escape: the following bytes are sent as-is (continuation packets or real-time bytes)' });
    out.push({ start: s + 1, end: head, label: 'Length', detail: `${e.data.length} byte${e.data.length === 1 ? '' : 's'} follow (variable-length quantity)` });
  }
  if (e.data.length) out.push({ start: head, end, label: 'Data', detail: hx(file.subarray(head, Math.min(end, head + 24))) + (e.data.length > 24 ? ' …' : '') });
  return out;
}

/** Explain the MThd chunk byte by byte. */
export function annotateHeader(smf: SmfFile): Annotation[] {
  const h = smf.headerOffset;
  const { format, declaredTracks, division, ppq, smpte } = smf.header;
  const formats = ['0: a single track', '1: several tracks played together (track 1 usually holds tempo and signatures)', '2: independent single-track patterns'];
  return [
    { start: h, end: h + 4, label: 'Chunk ID', detail: '"MThd": the header chunk' },
    { start: h + 4, end: h + 8, label: 'Length', detail: `${smf.headerLength} bytes of header data follow (always 6)` },
    { start: h + 8, end: h + 10, label: 'Format', detail: formats[format] ?? `${format}: unknown` },
    { start: h + 10, end: h + 12, label: 'Track count', detail: `${declaredTracks} track chunk${declaredTracks === 1 ? '' : 's'} (ntrks)` },
    {
      start: h + 12, end: h + 14, label: 'Division',
      detail: smpte
        ? `0x${division.toString(16).toUpperCase()}: bit 15 set, so timing is SMPTE: the high byte is −${smpte.fps === 29.97 ? 29 : smpte.fps} (${smpte.fps} frames per second${smpte.fps === 29.97 ? ', drop-frame' : ''}) and the low byte is ${smpte.ticksPerFrame} ticks per frame, i.e. ${Math.round(smpte.fps * smpte.ticksPerFrame)} ticks per second regardless of tempo`
        : `0x${division.toString(16).toUpperCase().padStart(4, '0')}: bit 15 clear, so ${ppq} ticks per quarter note (PPQ); tempo meta events set how long a quarter note lasts`,
    },
  ];
}

export const roleNames: Record<number, string> = {
  [Role.ChunkId]: 'Chunk ID', [Role.ChunkLength]: 'Chunk length', [Role.HeaderField]: 'Header field', [Role.Delta]: 'Delta-time',
  [Role.Status]: 'Status byte', [Role.Data]: 'Data byte', [Role.MetaHead]: 'Meta type & length', [Role.MetaData]: 'Meta data',
  [Role.SysexHead]: 'SysEx start & length', [Role.SysexData]: 'SysEx data',
};
