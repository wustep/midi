/**
 * System Exclusive helpers: manufacturer IDs, checksums, value encoding, and message assembly.
 * Dependency-free; shared by the SysEx builder tool and its tests.
 */

export interface Manufacturer {
  /** 1 byte (01–7F) or 3 bytes starting with 00. */
  id: number[];
  name: string;
}

/**
 * A selection of manufacturer IDs from the MIDI Association's public list
 * (https://midi.org/sysexidtable). Only well-known, stable assignments are included.
 */
export const MANUFACTURERS: Manufacturer[] = [
  { id: [0x01], name: 'Sequential Circuits' },
  { id: [0x04], name: 'Moog' },
  { id: [0x06], name: 'Lexicon' },
  { id: [0x07], name: 'Kurzweil' },
  { id: [0x0f], name: 'Ensoniq' },
  { id: [0x10], name: 'Oberheim' },
  { id: [0x18], name: 'E-mu' },
  { id: [0x33], name: 'Clavia (Nord)' },
  { id: [0x3e], name: 'Waldorf' },
  { id: [0x1a], name: 'ART' },
  { id: [0x40], name: 'Kawai' },
  { id: [0x41], name: 'Roland' },
  { id: [0x42], name: 'Korg' },
  { id: [0x43], name: 'Yamaha' },
  { id: [0x44], name: 'Casio' },
  { id: [0x47], name: 'Akai' },
  { id: [0x00, 0x00, 0x0e], name: 'Alesis' },
  { id: [0x00, 0x00, 0x66], name: 'Mackie' },
  { id: [0x00, 0x01, 0x05], name: 'M-Audio' },
  { id: [0x00, 0x01, 0x0c], name: 'Line 6' },
  { id: [0x00, 0x20, 0x29], name: 'Focusrite / Novation' },
  { id: [0x00, 0x20, 0x32], name: 'Behringer' },
  { id: [0x00, 0x20, 0x33], name: 'Access Music' },
  { id: [0x00, 0x20, 0x3c], name: 'Elektron' },
  { id: [0x00, 0x20, 0x6b], name: 'Arturia' },
  { id: [0x00, 0x21, 0x09], name: 'Native Instruments' },
  { id: [0x00, 0x21, 0x1d], name: 'Ableton' },
  { id: [0x7d], name: 'Non-commercial / educational use' },
  { id: [0x7e], name: 'Universal Non-Real Time' },
  { id: [0x7f], name: 'Universal Real Time' },
];

const key = (id: number[]) => id.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const BY_ID = new Map(MANUFACTURERS.map((m) => [key(m.id), m]));

/** Look up the manufacturer at the start of a SysEx body (the bytes after F0). */
export function manufacturerOf(body: number[]): { id: number[]; name?: string } | null {
  if (!body.length) return null;
  const id = body[0] === 0x00 ? body.slice(0, 3) : body.slice(0, 1);
  if (body[0] === 0x00 && id.length < 3) return { id };
  return { id, name: BY_ID.get(key(id))?.name };
}

/**
 * Roland-style checksum used by DT1/RQ1 messages: the 7-bit two's complement of the sum of the
 * address and data bytes, so that (sum + checksum) & 0x7F === 0.
 */
export function rolandChecksum(bytes: number[]): number {
  const sum = bytes.reduce((s, b) => s + b, 0);
  return (128 - (sum & 0x7f)) & 0x7f;
}

/** XOR of all bytes, masked to 7 bits (used by some Waldorf, Kurzweil, and DIY devices). */
export function xorChecksum(bytes: number[]): number {
  return bytes.reduce((x, b) => x ^ b, 0) & 0x7f;
}

/** Plain 7-bit sum of the bytes. */
export function sumChecksum(bytes: number[]): number {
  return bytes.reduce((s, b) => s + b, 0) & 0x7f;
}

export type ChecksumKind = 'none' | 'roland' | 'xor' | 'sum';

export function checksum(kind: ChecksumKind, bytes: number[]): number | null {
  switch (kind) {
    case 'roland': return rolandChecksum(bytes);
    case 'xor': return xorChecksum(bytes);
    case 'sum': return sumChecksum(bytes);
    default: return null;
  }
}

/** Split a non-negative integer into 7-bit bytes, most significant first, padded to `count` bytes. */
export function to7bit(value: number, count: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** (7 * count)) throw new RangeError(`${value} does not fit in ${count} 7-bit byte${count === 1 ? '' : 's'}`);
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(Math.floor(value / 2 ** (7 * i)) & 0x7f);
  return out;
}

export function from7bit(bytes: number[]): number {
  return bytes.reduce((v, b) => v * 128 + (b & 0x7f), 0);
}

/** Split a value into nibbles, most significant first (common for 8-bit values in older synths). */
export function toNibbles(value: number, count: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value >= 16 ** count) throw new RangeError(`${value} does not fit in ${count} nibble${count === 1 ? '' : 's'}`);
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push((value >> (4 * i)) & 0x0f);
  return out;
}

/**
 * Pack 8-bit data into 7-bit-safe groups: each group of up to 7 bytes is preceded by one byte holding
 * their high bits (bit 0 = first byte's MSB). This is the scheme used by many devices' bulk dumps
 * (often described as "8-to-7" or "MS-bit first byte").
 */
export function pack8to7(data: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 7) {
    const group = data.slice(i, i + 7);
    let msbs = 0;
    group.forEach((b, k) => {
      if (b & 0x80) msbs |= 1 << k;
    });
    out.push(msbs, ...group.map((b) => b & 0x7f));
  }
  return out;
}

export function unpack7to8(packed: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < packed.length; i += 8) {
    const msbs = packed[i];
    packed.slice(i + 1, i + 8).forEach((b, k) => out.push((b & 0x7f) | ((msbs >> k) & 1 ? 0x80 : 0)));
  }
  return out;
}

/** Parse bytes written as hex ("41 10", "0x41,0x10", "4110") or decimal ("65 16") into numbers. */
export function parseBytes(input: string, radix: 16 | 10 = 16): { bytes: number[]; error?: string } {
  const cleaned = input.replace(/0x/gi, radix === 16 ? ' ' : ' 0x').replace(/[,;\[\]]/g, ' ').trim();
  if (!cleaned) return { bytes: [] };
  const raw = cleaned.split(/\s+/);
  const tokens = radix === 16 ? raw.flatMap((t) => (t.length > 2 && t.length % 2 === 0 && /^[0-9a-f]+$/i.test(t) ? t.match(/../g)! : [t])) : raw;
  const bytes: number[] = [];
  for (const t of tokens) {
    const isHex = radix === 16 || /^0x/i.test(t);
    const digits = t.replace(/^0x/i, '');
    if (!(isHex ? /^[0-9a-f]{1,2}$/i : /^\d{1,3}$/).test(digits)) return { bytes, error: `"${t}" is not a ${isHex ? 'hex' : 'decimal'} byte` };
    const v = parseInt(digits, isHex ? 16 : 10);
    if (v > 255) return { bytes, error: `${t} is larger than 255` };
    bytes.push(v);
  }
  return { bytes };
}

export interface BuiltMessage {
  bytes: number[];
  /** Index range [start, end) of each part in `bytes`, for highlighting. */
  parts: { label: string; start: number; end: number; kind: 'frame' | 'id' | 'header' | 'data' | 'checksum' }[];
  problems: string[];
  checksum?: number;
}

/**
 * Assemble F0 <id> <header> <data> [checksum] F7. The checksum, when requested, covers either just the
 * data or the header plus data (`checksumOver`). For a Roland DT1, put device ID, model ID and command in
 * the header and the address plus values in the data, since the checksum covers address and data only.
 */
export function buildSysex(opts: {
  id: number[];
  header?: number[];
  data?: number[];
  checksum?: ChecksumKind;
  checksumOver?: 'data' | 'header+data';
}): BuiltMessage {
  const { id, header = [], data = [], checksum: kind = 'none', checksumOver = 'data' } = opts;
  const problems: string[] = [];
  if (!id.length) problems.push('A manufacturer ID is required.');
  else if (id[0] === 0x00 && id.length !== 3) problems.push('Extended manufacturer IDs are 3 bytes: 00 xx yy.');
  else if (id[0] !== 0x00 && id.length !== 1) problems.push('Single-byte manufacturer IDs are one byte (01–7F); extended IDs start with 00.');
  const body = [...id, ...header, ...data];
  const bad = body.map((b, i) => [b, i] as const).filter(([b]) => b > 0x7f);
  if (bad.length) problems.push(`${bad.length} byte${bad.length === 1 ? ' is' : 's are'} ≥ 0x80 (${bad.slice(0, 4).map(([b]) => b.toString(16).toUpperCase().padStart(2, '0')).join(', ')}${bad.length > 4 ? ', …' : ''}); SysEx payload bytes must be 00–7F. Use nibbles or 8-to-7 packing.`);
  const sumOver = checksumOver === 'header+data' ? [...header, ...data] : data;
  const cs = checksum(kind, sumOver.map((b) => b & 0x7f));
  const bytes = [0xf0, ...body, ...(cs === null ? [] : [cs]), 0xf7];
  const parts: BuiltMessage['parts'] = [];
  let at = 0;
  const add = (label: string, len: number, k: BuiltMessage['parts'][number]['kind']) => {
    if (len) parts.push({ label, start: at, end: at + len, kind: k });
    at += len;
  };
  add('Start of Exclusive', 1, 'frame');
  add('Manufacturer ID', id.length, 'id');
  add('Header', header.length, 'header');
  add('Data', data.length, 'data');
  if (cs !== null) add('Checksum', 1, 'checksum');
  add('End of Exclusive', 1, 'frame');
  return { bytes, parts, problems, checksum: cs ?? undefined };
}
