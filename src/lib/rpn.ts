/**
 * Registered and Non-Registered Parameter Numbers: a catalog of the RPNs defined by the MIDI
 * Association, a message builder, and a decoder that follows the CC 101/100/99/98/6/38/96/97 state
 * machine like a receiver does.
 */

export interface RpnDef {
  msb: number;
  lsb: number;
  name: string;
  /** How the 14-bit data value is interpreted. */
  unit: 'semitones+cents' | 'cents14' | 'semitones-centered' | 'program' | 'members' | 'raw';
  source: string;
  detail: string;
}

export const RPNS: RpnDef[] = [
  { msb: 0, lsb: 0, name: 'Pitch Bend Sensitivity', unit: 'semitones+cents', source: 'MIDI 1.0', detail: 'Data MSB = semitones, LSB = cents. GM default is ±2 semitones; MPE member channels default to ±48.' },
  { msb: 0, lsb: 1, name: 'Channel Fine Tuning', unit: 'cents14', source: 'MIDI 1.0', detail: '14-bit value; 8192 (40 00) = A440, the full range spans −100 to almost +100 cents.' },
  { msb: 0, lsb: 2, name: 'Channel Coarse Tuning', unit: 'semitones-centered', source: 'MIDI 1.0', detail: 'Data MSB only: 64 = no change, each step is one semitone (−64 to +63). LSB is ignored.' },
  { msb: 0, lsb: 3, name: 'Tuning Program Change', unit: 'program', source: 'MIDI Tuning Standard', detail: 'Data MSB selects a tuning program (0–127) in the current tuning bank.' },
  { msb: 0, lsb: 4, name: 'Tuning Bank Select', unit: 'program', source: 'MIDI Tuning Standard', detail: 'Data MSB selects a tuning bank (0–127).' },
  { msb: 0, lsb: 5, name: 'Modulation Depth Range', unit: 'semitones+cents', source: 'GM2 (CA-026)', detail: 'How far the modulation wheel can push vibrato: MSB semitones, LSB cents in 100/128 steps.' },
  { msb: 0, lsb: 6, name: 'MPE Configuration Message', unit: 'members', source: 'MPE', detail: 'Sent on channel 1 (lower zone) or 16 (upper zone); data MSB = number of member channels (0 turns the zone off).' },
  { msb: 0x3d, lsb: 0, name: 'Azimuth Angle', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Direction of the sound source in the horizontal plane.' },
  { msb: 0x3d, lsb: 1, name: 'Elevation Angle', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Direction of the sound source above or below the horizontal plane.' },
  { msb: 0x3d, lsb: 2, name: 'Gain', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Level of the source, before distance effects.' },
  { msb: 0x3d, lsb: 3, name: 'Distance Ratio', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Distance of the source relative to the maximum distance.' },
  { msb: 0x3d, lsb: 4, name: 'Maximum Distance', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'The distance that a distance ratio of 1 represents.' },
  { msb: 0x3d, lsb: 5, name: 'Gain at Maximum Distance', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Attenuation applied at the maximum distance.' },
  { msb: 0x3d, lsb: 6, name: 'Reference Distance Ratio', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Distance at which the gain applies without attenuation.' },
  { msb: 0x3d, lsb: 7, name: 'Pan Spread Angle', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Angular width of a stereo source.' },
  { msb: 0x3d, lsb: 8, name: 'Roll Angle', unit: 'raw', source: '3D Sound Controllers (RP-049)', detail: 'Rotation of the source around its front axis.' },
  { msb: 0x7f, lsb: 0x7f, name: 'RPN Null', unit: 'raw', source: 'MIDI 1.0', detail: 'Deselects the current parameter so stray Data Entry messages do nothing. Send it after every parameter write.' },
];

export const findRpn = (msb: number, lsb: number) => RPNS.find((r) => r.msb === msb && r.lsb === lsb);

export interface BuildOptions {
  channel: number;
  nrpn?: boolean;
  msb: number;
  lsb: number;
  /** 14-bit value (0–16383); with `msbOnly`, a 7-bit value sent as CC 6 alone. */
  value: number;
  msbOnly?: boolean;
  /** Append the null RPN (101/100 = 127/127). Default true. */
  nullAfter?: boolean;
  /** Instead of a value, send this many Data Increment (+) or Decrement (−) steps. */
  steps?: number;
}

/** CC messages that write one parameter. Each message is [status, cc, value]. */
export function buildParam(o: BuildOptions): number[][] {
  if (o.channel < 1 || o.channel > 16) throw new RangeError('Channel must be 1–16');
  for (const v of [o.msb, o.lsb]) if (!Number.isInteger(v) || v < 0 || v > 127) throw new RangeError('Parameter numbers are 0–127 each');
  const s = 0xb0 | (o.channel - 1);
  const [selM, selL] = o.nrpn ? [99, 98] : [101, 100];
  const out: number[][] = [[s, selM, o.msb], [s, selL, o.lsb]];
  if (o.steps) {
    const cc = o.steps > 0 ? 96 : 97;
    for (let i = 0; i < Math.abs(o.steps); i++) out.push([s, cc, 0]);
  } else if (o.msbOnly) {
    if (o.value < 0 || o.value > 127) throw new RangeError('7-bit values are 0–127');
    out.push([s, 6, o.value]);
  } else {
    if (!Number.isInteger(o.value) || o.value < 0 || o.value > 16383) throw new RangeError('14-bit values are 0–16383');
    out.push([s, 6, o.value >> 7], [s, 38, o.value & 0x7f]);
  }
  if (o.nullAfter ?? true) out.push([s, 101, 127], [s, 100, 127]);
  return out;
}

/** Flatten messages, optionally with running status (repeated Bn status bytes omitted). */
export function flatten(msgs: number[][], runningStatus = false): number[] {
  const out: number[] = [];
  let last = -1;
  for (const m of msgs) {
    if (runningStatus && m[0] === last) out.push(...m.slice(1));
    else out.push(...m);
    last = m[0];
  }
  return out;
}

/** Turn friendly units into the 14-bit data value, and back. */
export function encodeValue(def: Pick<RpnDef, 'unit'>, a: number, b = 0): number {
  switch (def.unit) {
    case 'semitones+cents': return (Math.max(0, Math.min(127, Math.round(a))) << 7) | Math.max(0, Math.min(127, Math.round(b)));
    case 'cents14': return Math.max(0, Math.min(16383, Math.round(8192 + (a / 100) * 8192)));
    case 'semitones-centered': return Math.max(0, Math.min(127, Math.round(64 + a))) << 7;
    case 'program':
    case 'members': return Math.max(0, Math.min(127, Math.round(a))) << 7;
    default: return Math.max(0, Math.min(16383, Math.round(a)));
  }
}

export function describeValue(def: Pick<RpnDef, 'unit'> | undefined, v: number): string {
  const msb = v >> 7;
  const lsb = v & 0x7f;
  switch (def?.unit) {
    case 'semitones+cents': return `${msb} semitone${msb === 1 ? '' : 's'}${lsb ? ` ${lsb} cent${lsb === 1 ? '' : 's'}` : ''}`;
    case 'cents14': {
      const c = ((v - 8192) / 8192) * 100;
      return `${c >= 0 ? '+' : ''}${c.toFixed(2)} cents`;
    }
    case 'semitones-centered': return `${msb - 64 >= 0 ? '+' : ''}${msb - 64} semitones`;
    case 'program': return `${msb}`;
    case 'members': return msb ? `${msb} member channel${msb === 1 ? '' : 's'}` : 'zone off';
    default: return `${v} (MSB ${msb}, LSB ${lsb})`;
  }
}

export interface ParamWrite {
  channel: number;
  nrpn: boolean;
  msb: number;
  lsb: number;
  /** Full 14-bit value after this message. */
  value: number;
  /** What caused it: data entry MSB/LSB or increment/decrement. */
  via: 'msb' | 'lsb' | 'inc' | 'dec';
  name?: string;
  /** Index of the message in the input. */
  index: number;
}

export interface DecodeResult {
  writes: ParamWrite[];
  /** Data entry received while no parameter (or the null RPN) was selected: ignored by receivers. */
  ignored: number[];
}

/**
 * Follow the parameter-number state machine across channel messages. Selecting an RPN clears the
 * NRPN selection and vice versa; the null RPN (127/127) deselects.
 */
export function decodeParams(msgs: number[][]): DecodeResult {
  const st = Array.from({ length: 16 }, () => ({ rpn: [127, 127], nrpn: [127, 127], active: 'none' as 'rpn' | 'nrpn' | 'none', value: 0 }));
  const writes: ParamWrite[] = [];
  const ignored: number[] = [];
  msgs.forEach((m, index) => {
    if ((m[0] & 0xf0) !== 0xb0 || m.length < 3) return;
    const ch = m[0] & 0x0f;
    const c = st[ch];
    const [, cc, v] = m;
    switch (cc) {
      case 101: c.rpn[0] = v; c.active = 'rpn'; c.value = 0; return;
      case 100: c.rpn[1] = v; c.active = 'rpn'; c.value = 0; return;
      case 99: c.nrpn[0] = v; c.active = 'nrpn'; c.value = 0; return;
      case 98: c.nrpn[1] = v; c.active = 'nrpn'; c.value = 0; return;
      case 6: case 38: case 96: case 97: {
        const sel = c.active === 'rpn' ? c.rpn : c.active === 'nrpn' ? c.nrpn : null;
        if (!sel || (c.active === 'rpn' && sel[0] === 127 && sel[1] === 127)) return void ignored.push(index);
        if (cc === 6) c.value = (v << 7) | (c.value & 0x7f);
        else if (cc === 38) c.value = (c.value & ~0x7f) | v;
        else c.value = Math.max(0, Math.min(16383, c.value + (cc === 96 ? 1 : -1)));
        const isRpn = c.active === 'rpn';
        writes.push({ channel: ch + 1, nrpn: !isRpn, msb: sel[0], lsb: sel[1], value: c.value, via: cc === 6 ? 'msb' : cc === 38 ? 'lsb' : cc === 96 ? 'inc' : 'dec', name: isRpn ? findRpn(sel[0], sel[1])?.name : undefined, index });
      }
    }
  });
  return { writes, ignored };
}

/** Split a byte stream of channel messages (with running status) into messages. */
export function splitMessages(bytes: number[]): number[][] {
  const out: number[][] = [];
  let status = -1;
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b >= 0xf8) { i++; continue; }
    if (b >= 0x80) {
      status = b;
      i++;
    } else if (status < 0) { i++; continue; }
    const hi = status & 0xf0;
    const need = hi === 0xc0 || hi === 0xd0 ? 1 : status >= 0xf0 ? 0 : 2;
    if (status >= 0xf0) { status = -1; continue; }
    const m = [status];
    while (m.length - 1 < need && i < bytes.length && bytes[i] < 0x80) m.push(bytes[i++]);
    if (m.length - 1 === need) out.push(m);
  }
  return out;
}
