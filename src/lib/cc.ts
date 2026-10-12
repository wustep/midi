/**
 * Control Change reference: all 128 controller numbers with their MIDI 1.0 assignments, what General
 * MIDI 1 and 2 require, MPE usage, and widely used (but non-standard) conventions. Device-specific
 * charts are out of scope; see the Pencil Research MIDI database (midi.guide) for those.
 */

export type CcKind = 'msb' | 'lsb' | 'switch' | 'sound' | 'effect' | 'param' | 'general' | 'mode' | 'undefined';

export interface CcInfo {
  number: number;
  name: string;
  kind: CcKind;
  /** Required by General MIDI Level 1. */
  gm1?: boolean;
  /** Part of the General MIDI Level 2 controller set. */
  gm2?: boolean;
  /** Typical power-on or reset value, where a standard defines one. */
  default?: { value: number; source: string };
  /** What the value means, e.g. "≤63 off, ≥64 on". */
  values?: string;
  /** Standardized meaning in more detail. */
  spec?: string;
  /** How instruments and software commonly use it, beyond the spec. */
  common?: string;
}

export const KIND_LABELS: Record<CcKind, string> = {
  msb: 'Continuous',
  lsb: 'LSB of a 14-bit pair',
  switch: 'Switch (on/off)',
  sound: 'Sound controller',
  effect: 'Effects depth',
  param: 'Parameter / data entry',
  general: 'General purpose',
  mode: 'Channel Mode message',
  undefined: 'Undefined (free)',
};

const SWITCH = '≤63 off, ≥64 on';
const base: Partial<Record<number, Omit<CcInfo, 'number'>>> = {
  0: { name: 'Bank Select', kind: 'msb', gm2: true, spec: 'Selects a bank of programs; takes effect at the next Program Change. Send CC 0, then CC 32, then the Program Change.', common: 'GS uses CC 0 for variation banks; XG uses CC 0 to pick voice type (e.g. 127 = drum kit).' },
  1: { name: 'Modulation Wheel', kind: 'msb', gm1: true, gm2: true, default: { value: 0, source: 'Reset All Controllers' }, spec: 'Modulation depth. GM2 devices apply it as vibrato.', common: 'Vibrato on most synths; dynamics (a crossfade between soft and loud samples) in many orchestral sample libraries.' },
  2: { name: 'Breath Controller', kind: 'msb', common: 'Sent by wind controllers and breath sensors; often mapped to volume, filter or dynamics.' },
  4: { name: 'Foot Controller', kind: 'msb', common: 'An expression pedal on a keyboard’s pedal jack, often doubled to CC 11.' },
  5: { name: 'Portamento Time', kind: 'msb', gm2: true, spec: 'How long a glide between notes takes, used with CC 65.' },
  6: { name: 'Data Entry', kind: 'param', gm1: true, gm2: true, spec: 'Sets the value of the RPN or NRPN currently selected with CC 101/100 or 99/98. CC 38 is its LSB.' },
  7: { name: 'Channel Volume', kind: 'msb', gm1: true, gm2: true, default: { value: 100, source: 'GM power-on' }, spec: 'Overall level of the channel. Not reset by Reset All Controllers.', common: 'Set once per track as a mix level; use CC 11 for moving dynamics.' },
  8: { name: 'Balance', kind: 'msb', spec: 'Left/right balance of a stereo sound; 64 is centered.' },
  10: { name: 'Pan', kind: 'msb', gm1: true, gm2: true, default: { value: 64, source: 'GM power-on' }, values: '0 = hard left, 64 = center, 127 = hard right', spec: 'Stereo position of the channel. Not reset by Reset All Controllers.' },
  11: { name: 'Expression', kind: 'msb', gm1: true, gm2: true, default: { value: 127, source: 'Reset All Controllers' }, spec: 'A percentage of Channel Volume, for swells and fades within a part.' },
  12: { name: 'Effect Control 1', kind: 'msb', spec: 'Controls a parameter of an effect.' },
  13: { name: 'Effect Control 2', kind: 'msb', spec: 'Controls a parameter of an effect.' },
  16: { name: 'General Purpose 1', kind: 'general' },
  17: { name: 'General Purpose 2', kind: 'general' },
  18: { name: 'General Purpose 3', kind: 'general' },
  19: { name: 'General Purpose 4', kind: 'general' },
  64: { name: 'Sustain (Damper Pedal)', kind: 'switch', gm1: true, gm2: true, default: { value: 0, source: 'Reset All Controllers' }, values: SWITCH, spec: 'Holds notes after their Note Off until the pedal is released.', common: 'Some pianos and sample libraries treat it as continuous for half-pedaling.' },
  65: { name: 'Portamento On/Off', kind: 'switch', gm2: true, values: SWITCH },
  66: { name: 'Sostenuto', kind: 'switch', gm2: true, values: SWITCH, spec: 'Holds only the notes that were down when the pedal was pressed.' },
  67: { name: 'Soft Pedal', kind: 'switch', gm2: true, values: SWITCH, spec: 'Softens the sound (the una corda pedal on a piano).' },
  68: { name: 'Legato Footswitch', kind: 'switch', values: SWITCH, spec: 'Plays overlapping notes as legato (monophonic slurs).' },
  69: { name: 'Hold 2', kind: 'switch', values: SWITCH, spec: 'Lengthens release times rather than holding notes indefinitely.' },
  70: { name: 'Sound Controller 1', kind: 'sound', spec: 'Default meaning: Sound Variation.' },
  71: { name: 'Sound Controller 2', kind: 'sound', gm2: true, spec: 'Default meaning: Timbre / Harmonic Intensity. GM2 applies it as filter resonance.', common: 'Filter resonance on many synths.' },
  72: { name: 'Sound Controller 3', kind: 'sound', gm2: true, spec: 'Default meaning: Release Time.' },
  73: { name: 'Sound Controller 4', kind: 'sound', gm2: true, spec: 'Default meaning: Attack Time.' },
  74: { name: 'Sound Controller 5', kind: 'sound', gm2: true, spec: 'Default meaning: Brightness. GM2 applies it as filter cutoff. In MPE it is the per-note “timbre” (third) dimension.', common: 'Filter cutoff on a great many synths, and Y-axis slide on MPE controllers.' },
  75: { name: 'Sound Controller 6', kind: 'sound', gm2: true, spec: 'GM2 assigns Decay Time.' },
  76: { name: 'Sound Controller 7', kind: 'sound', gm2: true, spec: 'GM2 assigns Vibrato Rate.' },
  77: { name: 'Sound Controller 8', kind: 'sound', gm2: true, spec: 'GM2 assigns Vibrato Depth.' },
  78: { name: 'Sound Controller 9', kind: 'sound', gm2: true, spec: 'GM2 assigns Vibrato Delay.' },
  79: { name: 'Sound Controller 10', kind: 'sound', spec: 'No default meaning.' },
  80: { name: 'General Purpose 5', kind: 'general', values: 'Often used as a switch' },
  81: { name: 'General Purpose 6', kind: 'general', values: 'Often used as a switch' },
  82: { name: 'General Purpose 7', kind: 'general', values: 'Often used as a switch' },
  83: { name: 'General Purpose 8', kind: 'general', values: 'Often used as a switch' },
  84: { name: 'Portamento Control', kind: 'msb', spec: 'The value is the note number the next note glides from.' },
  88: { name: 'High Resolution Velocity Prefix', kind: 'msb', spec: 'Sent just before a Note On to add 7 more bits of velocity resolution (CA-031).' },
  91: { name: 'Effects 1 Depth', kind: 'effect', gm2: true, default: { value: 40, source: 'GM2 power-on' }, spec: 'Default meaning: reverb send level.' },
  92: { name: 'Effects 2 Depth', kind: 'effect', spec: 'Formerly Tremolo Depth.' },
  93: { name: 'Effects 3 Depth', kind: 'effect', gm2: true, default: { value: 0, source: 'GM2 power-on' }, spec: 'Default meaning: chorus send level.' },
  94: { name: 'Effects 4 Depth', kind: 'effect', spec: 'Formerly Celeste (Detune) Depth.', common: 'XG uses it as the variation effect send.' },
  95: { name: 'Effects 5 Depth', kind: 'effect', spec: 'Formerly Phaser Depth.' },
  96: { name: 'Data Increment', kind: 'param', spec: 'Increments the selected RPN/NRPN by one. The value byte is ignored.' },
  97: { name: 'Data Decrement', kind: 'param', spec: 'Decrements the selected RPN/NRPN by one. The value byte is ignored.' },
  98: { name: 'NRPN LSB', kind: 'param', spec: 'Selects a Non-Registered Parameter (with CC 99); then send the value with CC 6/38.' },
  99: { name: 'NRPN MSB', kind: 'param', spec: 'Selects a Non-Registered Parameter (with CC 98).' },
  100: { name: 'RPN LSB', kind: 'param', gm1: true, gm2: true, spec: 'Selects a Registered Parameter (with CC 101). 0/0 is pitch bend sensitivity; 127/127 deselects (the null RPN).' },
  101: { name: 'RPN MSB', kind: 'param', gm1: true, gm2: true, spec: 'Selects a Registered Parameter (with CC 100).' },
  120: { name: 'All Sound Off', kind: 'mode', gm2: true, values: 'Value 0', spec: 'Silences every voice on the channel immediately, including release tails.' },
  121: { name: 'Reset All Controllers', kind: 'mode', gm1: true, gm2: true, values: 'Value 0', spec: 'Resets modulation, expression, pedals, pitch bend, pressure and the RPN/NRPN selection. Volume and pan are left alone (RP-015).' },
  122: { name: 'Local Control', kind: 'mode', values: '0 = off, 127 = on', spec: 'Disconnects (off) or connects (on) a keyboard instrument’s keys from its own sound engine.' },
  123: { name: 'All Notes Off', kind: 'mode', gm1: true, gm2: true, values: 'Value 0', spec: 'Releases every note on the channel; notes held by the sustain pedal keep sounding until it is released.' },
  124: { name: 'Omni Mode Off', kind: 'mode', values: 'Value 0', spec: 'Also acts as All Notes Off.' },
  125: { name: 'Omni Mode On', kind: 'mode', values: 'Value 0', spec: 'Also acts as All Notes Off.' },
  126: { name: 'Mono Mode On', kind: 'mode', values: 'Number of channels (0 = as many as voices)', spec: 'Also acts as All Notes Off.' },
  127: { name: 'Poly Mode On', kind: 'mode', values: 'Value 0', spec: 'Also acts as All Notes Off.' },
};

const FREE = 'Undefined in the MIDI 1.0 specification, so it won’t collide with standard meanings.';

/** All 128 controllers. */
export const CCS: CcInfo[] = Array.from({ length: 128 }, (_, n) => {
  const b = base[n];
  if (b) return { number: n, ...b };
  if (n >= 32 && n <= 63) {
    const msb = base[n - 32];
    return {
      number: n,
      name: `LSB for CC ${n - 32}${msb ? ` (${msb.name})` : ''}`,
      kind: 'lsb',
      ...(n === 32 || n === 38 ? { gm2: true } : {}),
      spec: `Low 7 bits of CC ${n - 32}. Send the MSB first; a new MSB resets the LSB to 0 on many receivers.`,
    };
  }
  return {
    number: n,
    name: 'Undefined',
    kind: 'undefined',
    spec: FREE,
    ...(n >= 20 && n <= 31 ? { common: 'A popular range for custom controller assignments.' } : n >= 102 && n <= 119 ? { common: 'A popular range for custom controller assignments, and for DAW and controller-surface mappings.' } : {}),
  };
});

/** The bytes for a Control Change message on a channel (1–16). */
export function ccBytes(channel: number, cc: number, value: number): number[] {
  if (channel < 1 || channel > 16) throw new RangeError('Channel must be 1–16');
  if (cc < 0 || cc > 127 || value < 0 || value > 127) throw new RangeError('Controller and value must be 0–127');
  return [0xb0 | (channel - 1), cc, value];
}

/** A 14-bit controller value as MSB (CC n) and LSB (CC n + 32) messages. */
export function cc14Bytes(channel: number, cc: number, value: number): number[] {
  if (cc < 0 || cc > 31) throw new RangeError('14-bit controllers are CC 0–31 (with LSBs 32–63)');
  if (value < 0 || value > 16383) throw new RangeError('14-bit values are 0–16383');
  return [...ccBytes(channel, cc, value >> 7), ...ccBytes(channel, cc + 32, value & 0x7f)];
}

/** Bytes to set a Registered Parameter: select with CC 101/100, write with CC 6/38, then deselect. */
export function rpnBytes(channel: number, msb: number, lsb: number, value: number, nrpn = false): number[] {
  const sel = nrpn ? [99, 98] : [101, 100];
  return [
    ...ccBytes(channel, sel[0], msb), ...ccBytes(channel, sel[1], lsb),
    ...ccBytes(channel, 6, value >> 7), ...ccBytes(channel, 38, value & 0x7f),
    ...ccBytes(channel, 101, 127), ...ccBytes(channel, 100, 127),
  ];
}

export function filterCcs(query: string, kind: string): CcInfo[] {
  const q = query.trim().toLowerCase();
  return CCS.filter((c) => {
    if (kind === 'gm1' && !c.gm1) return false;
    if (kind === 'gm2' && !c.gm2) return false;
    if (kind !== 'all' && kind !== 'gm1' && kind !== 'gm2' && c.kind !== kind) return false;
    if (!q) return true;
    if (/^\d+$/.test(q)) return c.number === Number(q);
    if (/^0x[0-9a-f]+$/.test(q)) return c.number === parseInt(q, 16);
    return [c.name, c.spec, c.common, KIND_LABELS[c.kind]].some((t) => t?.toLowerCase().includes(q));
  });
}
