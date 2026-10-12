/**
 * "Editor-lite" operations on a parsed Standard MIDI File: export a subset of tracks, transpose,
 * change tempo, merge to format 0, and convert to CSV (midicsv-compatible) or JSON.
 */
import { decodeText, metaName, toDeltas, writeSmf, type SmfEvent, type SmfFile, type TempoMap } from './smf.ts';
import { buildTempoMap } from './smf.ts';

export interface ExportOptions {
  /** Track indexes to include (default: all). */
  tracks?: number[];
  /** Semitones to transpose notes and poly pressure (default 0). */
  transpose?: number;
  /** Leave channel 10 (drums) untransposed (default true). */
  skipDrums?: boolean;
  /** Multiply every tempo by this factor: 2 = twice as fast (default 1). */
  tempoScale?: number;
  /** Output format: 1 keeps tracks separate, 0 merges into one track (default: same as the input, 2 becomes 1). */
  format?: 0 | 1;
  /** Drop SysEx events (default false). */
  stripSysex?: boolean;
  /** Multiply note-on velocities, clamped to 1–127 (default 1). */
  velocityScale?: number;
}

export interface ExportResult {
  bytes: Uint8Array;
  /** Notes dropped because transposing pushed them outside 0–127. */
  droppedNotes: number;
  tracks: number;
  format: 0 | 1;
}

const isConductorMeta = (e: SmfEvent) => e.kind === 'meta' && (e.metaType === 0x51 || e.metaType === 0x58 || e.metaType === 0x59 || e.metaType === 0x54);

export function exportSmf(smf: SmfFile, opts: ExportOptions = {}): ExportResult {
  if (smf.header.smpte && opts.tempoScale && opts.tempoScale !== 1) throw new Error('This file uses SMPTE timing, so tempo can’t be scaled.');
  const pick = new Set(opts.tracks ?? smf.tracks.map((t) => t.index));
  const transpose = Math.round(opts.transpose ?? 0);
  const skipDrums = opts.skipDrums ?? true;
  const tempoScale = opts.tempoScale ?? 1;
  const velScale = opts.velocityScale ?? 1;
  if (!(tempoScale > 0)) throw new RangeError('Tempo scale must be positive');
  const format: 0 | 1 = opts.format ?? (smf.header.format === 0 ? 0 : 1);
  let dropped = 0;

  const convert = (e: SmfEvent): number[] | null => {
    if (e.kind === 'meta') {
      if (e.metaType === 0x2f) return null; // writer appends End of Track
      if (e.metaType === 0x51 && tempoScale !== 1 && e.data.length >= 3) {
        const us = (e.data[0] << 16) | (e.data[1] << 8) | e.data[2];
        const v = Math.max(1, Math.min(0xffffff, Math.round(us / tempoScale)));
        return [0xff, 0x51, 0x03, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
      }
      return e.bytes;
    }
    if (e.kind === 'sysex') return opts.stripSysex ? null : e.bytes;
    const b = [...e.bytes];
    const isNoteMsg = e.type === 'noteOn' || e.type === 'noteOff' || e.type === 'polyPressure';
    if (isNoteMsg && transpose && !(skipDrums && e.channel === 9)) {
      const n = e.data1 + transpose;
      // A note's On and Off transpose identically, so both are dropped together.
      if (n < 0 || n > 127) {
        if (e.type === 'noteOn' && (e.data2 ?? 0) > 0) dropped++;
        return null;
      }
      b[1] = n;
    }
    if (e.type === 'noteOn' && (e.data2 ?? 0) > 0 && velScale !== 1) b[2] = Math.max(1, Math.min(127, Math.round(b[2] * velScale)));
    return b;
  };

  const outTracks: { tick: number; bytes: number[] }[][] = [];
  // Tempo, meter and key from unselected tracks still apply, so carry them into the first output track.
  const carried: { tick: number; bytes: number[] }[] = [];
  for (const t of smf.tracks) {
    if (pick.has(t.index)) continue;
    for (const e of t.events) if (isConductorMeta(e)) carried.push({ tick: e.tick, bytes: convert(e)! });
  }
  for (const t of smf.tracks) {
    if (!pick.has(t.index)) continue;
    const list: { tick: number; bytes: number[] }[] = [];
    for (const e of t.events) {
      const b = convert(e);
      if (b) list.push({ tick: e.tick, bytes: b });
    }
    outTracks.push(list);
  }
  if (!outTracks.length) throw new Error('Select at least one track to export.');
  if (carried.length) outTracks[0] = [...carried, ...outTracks[0]];
  const ends = smf.tracks.filter((t) => pick.has(t.index)).map((t) => t.endTick);
  const end = ends.reduce((m, t) => Math.max(m, t), 0);

  let tracks: { tick: number; bytes: number[] }[][];
  if (format === 0) {
    // Merge, keeping each event's original order within a tick (track order, then file order).
    const merged = outTracks.flatMap((list, ti) => list.map((e, i) => ({ ...e, k: ti * 1e7 + i })));
    merged.sort((a, b) => a.tick - b.tick || a.k - b.k);
    tracks = [merged.map(({ tick, bytes }) => ({ tick, bytes }))];
  } else tracks = outTracks;

  const written = tracks.map((list) => toDeltas([...list, { tick: Math.max(end, list.at(-1)?.tick ?? 0), bytes: [0xff, 0x2f, 0x00] }]));
  const bytes = writeSmf({ format, ppq: smf.header.ppq ?? 480, tracks: written, runningStatus: true });
  if (smf.header.smpte) {
    // Keep the SMPTE division word.
    bytes[12] = (smf.header.division >> 8) & 0xff;
    bytes[13] = smf.header.division & 0xff;
  }
  return { bytes, droppedNotes: dropped, tracks: tracks.length, format };
}

/* ---------------- CSV (midicsv format) ---------------- */

/** Quote a string the way midicsv does: backslash-escape quotes and backslashes, octal-escape others. */
function csvString(data: number[]): string {
  let s = '"';
  for (const c of data) {
    if (c === 0x22) s += '\\"';
    else if (c === 0x5c) s += '\\\\';
    else if (c < 0x20 || c > 0x7e) s += `\\${c.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(c);
  }
  return `${s}"`;
}

const TEXT_TYPES: Record<number, string> = {
  0x01: 'Text_t', 0x02: 'Copyright_t', 0x03: 'Title_t', 0x04: 'Instrument_name_t', 0x05: 'Lyric_t', 0x06: 'Marker_t', 0x07: 'Cue_point_t',
};

/**
 * Convert to the CSV format of John Walker's midicsv: one record per line, "Track, Time, Type, values…",
 * with tracks numbered from 1 and the header and end-of-file records on track 0.
 */
export function toCsv(smf: SmfFile): string {
  const lines: string[] = [`0, 0, Header, ${smf.header.format}, ${smf.tracks.length}, ${smf.header.division}`];
  for (const t of smf.tracks) {
    const n = t.index + 1;
    lines.push(`${n}, 0, Start_track`);
    let sawEnd = false;
    for (const e of t.events) {
      const p = `${n}, ${e.tick}, `;
      if (e.kind === 'channel') {
        const ch = e.channel;
        switch (e.type) {
          case 'noteOn': lines.push(`${p}Note_on_c, ${ch}, ${e.data1}, ${e.data2}`); break;
          case 'noteOff': lines.push(`${p}Note_off_c, ${ch}, ${e.data1}, ${e.data2}`); break;
          case 'polyPressure': lines.push(`${p}Poly_aftertouch_c, ${ch}, ${e.data1}, ${e.data2}`); break;
          case 'controlChange': lines.push(`${p}Control_c, ${ch}, ${e.data1}, ${e.data2}`); break;
          case 'programChange': lines.push(`${p}Program_c, ${ch}, ${e.data1}`); break;
          case 'channelPressure': lines.push(`${p}Channel_aftertouch_c, ${ch}, ${e.data1}`); break;
          case 'pitchBend': lines.push(`${p}Pitch_bend_c, ${ch}, ${((e.data2 ?? 0) << 7) | e.data1}`); break;
        }
      } else if (e.kind === 'sysex') {
        lines.push(`${p}${e.status === 0xf0 ? 'System_exclusive' : 'System_exclusive_packet'}, ${e.data.length}${e.data.length ? ', ' + e.data.join(', ') : ''}`);
      } else {
        const d = e.data;
        switch (e.metaType) {
          case 0x00: lines.push(`${p}Sequence_number, ${d.length >= 2 ? (d[0] << 8) | d[1] : 0}`); break;
          case 0x20: lines.push(`${p}Channel_prefix, ${d[0] ?? 0}`); break;
          case 0x21: lines.push(`${p}MIDI_port, ${d[0] ?? 0}`); break;
          case 0x2f: lines.push(`${p}End_track`); sawEnd = true; break;
          case 0x51: lines.push(`${p}Tempo, ${(d[0] << 16) | (d[1] << 8) | d[2]}`); break;
          case 0x54: lines.push(`${p}SMPTE_offset, ${d.slice(0, 5).join(', ')}`); break;
          case 0x58: lines.push(`${p}Time_signature, ${d.slice(0, 4).join(', ')}`); break;
          case 0x59: lines.push(`${p}Key_signature, ${d[0] > 127 ? d[0] - 256 : d[0]}, "${d[1] === 1 ? 'minor' : 'major'}"`); break;
          case 0x7f: lines.push(`${p}Sequencer_specific, ${d.length}${d.length ? ', ' + d.join(', ') : ''}`); break;
          default:
            if (TEXT_TYPES[e.metaType]) lines.push(`${p}${TEXT_TYPES[e.metaType]}, ${csvString(d)}`);
            else lines.push(`${p}Unknown_meta_event, ${e.metaType}, ${d.length}${d.length ? ', ' + d.join(', ') : ''}`);
        }
      }
    }
    if (!sawEnd) lines.push(`${n}, ${t.endTick}, End_track`);
  }
  lines.push('0, 0, End_of_file');
  return lines.join('\n') + '\n';
}

/* ---------------- JSON ---------------- */

export function toJson(smf: SmfFile, tempo: TempoMap = buildTempoMap(smf)) {
  const describe = (e: SmfEvent) => {
    const base = { tick: e.tick, time: Math.round(tempo.tickToSeconds(e.tick) * 1e6) / 1e6 };
    if (e.kind === 'channel') {
      const out: Record<string, unknown> = { ...base, type: e.type, channel: e.channel + 1 };
      if (e.type === 'noteOn' || e.type === 'noteOff') Object.assign(out, { note: e.data1, velocity: e.data2 });
      else if (e.type === 'polyPressure') Object.assign(out, { note: e.data1, pressure: e.data2 });
      else if (e.type === 'controlChange') Object.assign(out, { controller: e.data1, value: e.data2 });
      else if (e.type === 'programChange') Object.assign(out, { program: e.data1 });
      else if (e.type === 'channelPressure') Object.assign(out, { pressure: e.data1 });
      else if (e.type === 'pitchBend') Object.assign(out, { value: (((e.data2 ?? 0) << 7) | e.data1) - 8192 });
      return out;
    }
    if (e.kind === 'sysex') return { ...base, type: e.status === 0xf0 ? 'sysex' : 'sysexEscape', data: e.data };
    const out: Record<string, unknown> = { ...base, type: 'meta', metaType: e.metaType, name: metaName(e.metaType) };
    if (e.metaType >= 0x01 && e.metaType <= 0x0f) out.text = decodeText(e.data);
    else if (e.metaType === 0x51) out.microsecondsPerQuarter = (e.data[0] << 16) | (e.data[1] << 8) | e.data[2];
    else if (e.data.length) out.data = e.data;
    return out;
  };
  return {
    header: { format: smf.header.format, tracks: smf.tracks.length, ...(smf.header.ppq ? { ticksPerQuarter: smf.header.ppq } : { smpte: smf.header.smpte }) },
    tempos: tempo.points.map((p) => ({ tick: p.tick, time: Math.round(p.seconds * 1e6) / 1e6, bpm: Math.round(p.bpm * 1000) / 1000 })),
    tracks: smf.tracks.map((t) => ({ index: t.index + 1, name: t.name ?? null, events: t.events.map(describe) })),
  };
}
