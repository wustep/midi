/**
 * Small, dependency-free MIDI helpers shared by the interactive tools and the Web MIDI monitor.
 * Everything here runs in the browser.
 */

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

/** Note name for a MIDI note number. `middleCOctave` is 4 for scientific pitch (C4 = 60), 3 for Yamaha style. */
export function noteName(n: number, middleCOctave = 4): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - (5 - middleCOctave)}`;
}

/** Equal-tempered frequency of a MIDI note. */
export function noteFrequency(n: number, a4 = 440): number {
  return a4 * Math.pow(2, (n - 69) / 12);
}

/** Nearest MIDI note (fractional) for a frequency. */
export function frequencyToNote(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export const GM_PROGRAMS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
];

/** GM1 percussion key map (channel 10), keys 35–81. */
export const GM_DRUMS: Record<number, string> = {
  35: 'Acoustic Bass Drum', 36: 'Bass Drum 1', 37: 'Side Stick', 38: 'Acoustic Snare', 39: 'Hand Clap', 40: 'Electric Snare',
  41: 'Low Floor Tom', 42: 'Closed Hi Hat', 43: 'High Floor Tom', 44: 'Pedal Hi-Hat', 45: 'Low Tom', 46: 'Open Hi-Hat',
  47: 'Low-Mid Tom', 48: 'Hi-Mid Tom', 49: 'Crash Cymbal 1', 50: 'High Tom', 51: 'Ride Cymbal 1', 52: 'Chinese Cymbal',
  53: 'Ride Bell', 54: 'Tambourine', 55: 'Splash Cymbal', 56: 'Cowbell', 57: 'Crash Cymbal 2', 58: 'Vibraslap',
  59: 'Ride Cymbal 2', 60: 'Hi Bongo', 61: 'Low Bongo', 62: 'Mute Hi Conga', 63: 'Open Hi Conga', 64: 'Low Conga',
  65: 'High Timbale', 66: 'Low Timbale', 67: 'High Agogo', 68: 'Low Agogo', 69: 'Cabasa', 70: 'Maracas',
  71: 'Short Whistle', 72: 'Long Whistle', 73: 'Short Guiro', 74: 'Long Guiro', 75: 'Claves', 76: 'Hi Wood Block',
  77: 'Low Wood Block', 78: 'Mute Cuica', 79: 'Open Cuica', 80: 'Mute Triangle', 81: 'Open Triangle',
};

const CC: Record<number, string> = {
  0: 'Bank Select (MSB)', 1: 'Modulation Wheel', 2: 'Breath Controller', 4: 'Foot Controller', 5: 'Portamento Time',
  6: 'Data Entry (MSB)', 7: 'Channel Volume', 8: 'Balance', 10: 'Pan', 11: 'Expression', 12: 'Effect Control 1',
  13: 'Effect Control 2', 16: 'General Purpose 1', 17: 'General Purpose 2', 18: 'General Purpose 3', 19: 'General Purpose 4',
  64: 'Sustain (Damper) Pedal', 65: 'Portamento On/Off', 66: 'Sostenuto', 67: 'Soft Pedal', 68: 'Legato Footswitch', 69: 'Hold 2',
  70: 'Sound Variation', 71: 'Timbre / Harmonic Intensity', 72: 'Release Time', 73: 'Attack Time', 74: 'Brightness',
  75: 'Decay Time', 76: 'Vibrato Rate', 77: 'Vibrato Depth', 78: 'Vibrato Delay', 79: 'Sound Controller 10',
  80: 'General Purpose 5', 81: 'General Purpose 6', 82: 'General Purpose 7', 83: 'General Purpose 8', 84: 'Portamento Control',
  88: 'High Resolution Velocity Prefix', 91: 'Effects 1 Depth (Reverb)', 92: 'Effects 2 Depth (Tremolo)', 93: 'Effects 3 Depth (Chorus)',
  94: 'Effects 4 Depth (Detune)', 95: 'Effects 5 Depth (Phaser)', 96: 'Data Increment', 97: 'Data Decrement',
  98: 'NRPN (LSB)', 99: 'NRPN (MSB)', 100: 'RPN (LSB)', 101: 'RPN (MSB)',
  120: 'All Sound Off', 121: 'Reset All Controllers', 122: 'Local Control', 123: 'All Notes Off',
  124: 'Omni Mode Off', 125: 'Omni Mode On', 126: 'Mono Mode On', 127: 'Poly Mode On',
};

export function ccName(n: number): string {
  if (CC[n]) return CC[n];
  if (n >= 32 && n <= 63) return `LSB for CC ${n - 32}${CC[n - 32] ? ` (${CC[n - 32].replace(' (MSB)', '')})` : ''}`;
  return 'Undefined';
}

export type Kind = 'channel' | 'mode' | 'common' | 'realtime' | 'sysex' | 'unknown';

export interface Field {
  label: string;
  value: string;
}

export interface Decoded {
  bytes: number[];
  kind: Kind;
  /** Short message name, e.g. "Note On" */
  name: string;
  /** 1–16 for channel messages */
  channel?: number;
  /** One-line human-readable summary */
  summary: string;
  fields: Field[];
  /** True if decoded using a running-status byte that was not present in `bytes` */
  runningStatus?: boolean;
  error?: string;
}

/** Number of data bytes that follow a status byte, or -1 for SysEx (variable). */
export function dataLength(status: number): number {
  const hi = status & 0xf0;
  if (hi === 0xc0 || hi === 0xd0) return 1;
  if (hi >= 0x80 && hi <= 0xe0) return 2;
  switch (status) {
    case 0xf0: return -1;
    case 0xf1: case 0xf3: return 1;
    case 0xf2: return 2;
    default: return 0;
  }
}

export const hex = (b: number, width = 2) => b.toString(16).toUpperCase().padStart(width, '0');
export const hexBytes = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => hex(b)).join(' ');

/** Manufacturer IDs that are safe to label. */
const MANUFACTURERS: Record<string, string> = {
  '01': 'Sequential', '04': 'Moog', '07': 'Kurzweil', '18': 'E-mu', '40': 'Kawai', '41': 'Roland', '42': 'Korg',
  '43': 'Yamaha', '44': 'Casio', '47': 'Akai', '7D': 'Non-commercial / educational', '7E': 'Universal Non-Real Time',
  '7F': 'Universal Real Time', '00 20 29': 'Novation (Focusrite)', '00 20 32': 'Behringer', '00 20 33': 'Access Music',
  '00 20 3C': 'Elektron',
};

function decodeSysex(bytes: number[]): Decoded {
  const fields: Field[] = [];
  const terminated = bytes[bytes.length - 1] === 0xf7;
  const body = bytes.slice(1, terminated ? -1 : undefined);
  let summary = `System Exclusive, ${bytes.length} bytes`;
  if (body.length) {
    const idLen = body[0] === 0x00 ? 3 : 1;
    const id = hexBytes(body.slice(0, idLen));
    fields.push({ label: 'Manufacturer ID', value: `${id}${MANUFACTURERS[id] ? ` (${MANUFACTURERS[id]})` : ''}` });
    if ((body[0] === 0x7e || body[0] === 0x7f) && body.length >= 3) {
      fields.push({ label: 'Device ID', value: body[1] === 0x7f ? '7F (all call)' : hex(body[1]) });
      const sub = `${hex(body[2])} ${body[3] !== undefined ? hex(body[3]) : ''}`.trim();
      const known: Record<string, string> = {
        '7E 06 01': 'Identity Request', '7E 06 02': 'Identity Reply', '7E 09 01': 'General MIDI System On',
        '7E 09 02': 'General MIDI System Off', '7E 09 03': 'General MIDI 2 System On', '7F 04 01': 'Master Volume',
        '7F 04 02': 'Master Balance', '7F 01 01': 'MTC Full Frame', '7E 7E': 'Wait', '7E 7C': 'Wait', '7E 7D': 'Cancel',
      };
      const label = known[`${hex(body[0])} ${sub}`] ?? (body[0] === 0x7e && body[2] === 0x0d ? 'MIDI-CI' : undefined);
      fields.push({ label: 'Sub-ID #1 / #2', value: `${sub}${label ? ` (${label})` : ''}` });
      if (label) summary = `Universal SysEx: ${label}`;
    }
    if (body.some((b) => b > 0x7f)) fields.push({ label: 'Problem', value: 'Contains bytes ≥ 0x80 inside the payload' });
  }
  fields.push({ label: 'Payload', value: `${Math.max(0, body.length)} bytes` });
  return {
    bytes, kind: 'sysex', name: 'System Exclusive', summary, fields,
    error: terminated ? undefined : 'Missing F7 (End of Exclusive)',
  };
}

/** Decode a single complete MIDI 1.0 message (status byte first). */
export function decodeMessage(bytes: number[], runningStatus = false): Decoded {
  const status = bytes[0];
  if (status === undefined) return { bytes, kind: 'unknown', name: 'Empty', summary: 'No bytes', fields: [] };
  if (status < 0x80) {
    return { bytes, kind: 'unknown', name: 'Data byte', summary: 'Data byte without a status byte', fields: [], error: 'Expected a status byte (0x80–0xFF) first' };
  }
  if (status === 0xf0) return decodeSysex(bytes);

  const need = dataLength(status);
  const d1 = bytes[1];
  const d2 = bytes[2];
  const missing = bytes.length - 1 < need ? `Expected ${need} data byte${need === 1 ? '' : 's'}, got ${bytes.length - 1}` : undefined;
  const base = { bytes, runningStatus, error: missing };

  if (status < 0xf0) {
    const type = status & 0xf0;
    const channel = (status & 0x0f) + 1;
    const ch = { label: 'Channel', value: `${channel} (nibble ${hex(status & 0x0f, 1)})` };
    const note = (n: number) => `${n} · ${noteName(n)}${channel === 10 && GM_DRUMS[n] ? ` · ${GM_DRUMS[n]}` : ''}`;
    switch (type) {
      case 0x80:
        return { ...base, kind: 'channel', name: 'Note Off', channel, summary: `Note Off ${noteName(d1 ?? 0)} vel ${d2 ?? '?'}`,
          fields: [ch, { label: 'Note', value: note(d1 ?? 0) }, { label: 'Release velocity', value: String(d2 ?? '?') }] };
      case 0x90: {
        const off = d2 === 0;
        return { ...base, kind: 'channel', name: off ? 'Note On (vel 0 = Note Off)' : 'Note On', channel,
          summary: off ? `Note Off ${noteName(d1 ?? 0)} (Note On, velocity 0)` : `Note On ${noteName(d1 ?? 0)} vel ${d2 ?? '?'}`,
          fields: [ch, { label: 'Note', value: note(d1 ?? 0) }, { label: 'Velocity', value: off ? '0 (treated as Note Off)' : String(d2 ?? '?') }] };
      }
      case 0xa0:
        return { ...base, kind: 'channel', name: 'Polyphonic Key Pressure', channel, summary: `Poly Pressure ${noteName(d1 ?? 0)} = ${d2 ?? '?'}`,
          fields: [ch, { label: 'Note', value: note(d1 ?? 0) }, { label: 'Pressure', value: String(d2 ?? '?') }] };
      case 0xb0: {
        const isMode = (d1 ?? 0) >= 120;
        let valueText = String(d2 ?? '?');
        if (d1 === 122) valueText = d2 === 0 ? '0 (Local Off)' : d2 === 127 ? '127 (Local On)' : valueText;
        else if (d1 === 126) valueText = `${d2} (${d2 === 0 ? 'channels = voices' : `${d2} channel${d2 === 1 ? '' : 's'}`})`;
        else if (d1 !== undefined && d1 >= 64 && d1 <= 69 && d2 !== undefined) valueText = `${d2} (${d2 >= 64 ? 'on' : 'off'})`;
        return { ...base, kind: isMode ? 'mode' : 'channel', name: isMode ? 'Channel Mode' : 'Control Change', channel,
          summary: `${isMode ? '' : `CC ${d1} `}${ccName(d1 ?? 0)}${isMode && d1 !== 122 && d1 !== 126 ? '' : ` = ${d2 ?? '?'}`}`,
          fields: [ch, { label: 'Controller', value: `${d1} · ${ccName(d1 ?? 0)}` }, { label: 'Value', value: valueText }] };
      }
      case 0xc0:
        return { ...base, kind: 'channel', name: 'Program Change', channel,
          summary: `Program ${(d1 ?? 0) + 1}${channel === 10 ? '' : ` · ${GM_PROGRAMS[d1 ?? 0]}`}`,
          fields: [ch, { label: 'Program', value: `${d1} on the wire = program ${(d1 ?? 0) + 1}` },
            ...(channel === 10 ? [] : [{ label: 'GM sound', value: GM_PROGRAMS[d1 ?? 0] }])] };
      case 0xd0:
        return { ...base, kind: 'channel', name: 'Channel Pressure', channel, summary: `Channel Pressure ${d1 ?? '?'}`,
          fields: [ch, { label: 'Pressure', value: String(d1 ?? '?') }] };
      case 0xe0: {
        const v = ((d2 ?? 0x40) << 7) | (d1 ?? 0);
        const rel = v - 8192;
        return { ...base, kind: 'channel', name: 'Pitch Bend', channel, summary: `Pitch Bend ${rel >= 0 ? '+' : ''}${rel}`,
          fields: [ch, { label: 'LSB / MSB', value: `${d1 ?? '?'} / ${d2 ?? '?'}` }, { label: '14-bit value', value: `${v} (center 8192)` },
            { label: 'At ±2 semitones', value: `${((rel / 8192) * 200).toFixed(1)} cents` }] };
      }
    }
  }

  switch (status) {
    case 0xf1: {
      const piece = ((d1 ?? 0) >> 4) & 0x7;
      const names = ['Frames low nibble', 'Frames high nibble', 'Seconds low nibble', 'Seconds high nibble', 'Minutes low nibble', 'Minutes high nibble', 'Hours low nibble', 'Hours high nibble + rate'];
      return { ...base, kind: 'common', name: 'MTC Quarter Frame', summary: `MTC Quarter Frame: ${names[piece]}`,
        fields: [{ label: 'Piece', value: `${piece} · ${names[piece]}` }, { label: 'Value nibble', value: hex((d1 ?? 0) & 0x0f, 1) }] };
    }
    case 0xf2: {
      const beats = ((d2 ?? 0) << 7) | (d1 ?? 0);
      return { ...base, kind: 'common', name: 'Song Position Pointer', summary: `Song Position ${beats} sixteenths`,
        fields: [{ label: 'MIDI beats (16ths)', value: String(beats) }, { label: 'MIDI clocks', value: String(beats * 6) }, { label: 'Quarter notes', value: String(beats / 4) }] };
    }
    case 0xf3:
      return { ...base, kind: 'common', name: 'Song Select', summary: `Song Select ${d1 ?? '?'}`, fields: [{ label: 'Song', value: String(d1 ?? '?') }] };
    case 0xf6:
      return { ...base, kind: 'common', name: 'Tune Request', summary: 'Tune Request', fields: [] };
    case 0xf7:
      return { ...base, kind: 'common', name: 'End of Exclusive', summary: 'End of Exclusive (stray F7)', fields: [] };
    case 0xf8: return { ...base, kind: 'realtime', name: 'Timing Clock', summary: 'Timing Clock (24 per quarter note)', fields: [] };
    case 0xfa: return { ...base, kind: 'realtime', name: 'Start', summary: 'Start', fields: [] };
    case 0xfb: return { ...base, kind: 'realtime', name: 'Continue', summary: 'Continue', fields: [] };
    case 0xfc: return { ...base, kind: 'realtime', name: 'Stop', summary: 'Stop', fields: [] };
    case 0xfe: return { ...base, kind: 'realtime', name: 'Active Sensing', summary: 'Active Sensing', fields: [] };
    case 0xff: return { ...base, kind: 'realtime', name: 'System Reset', summary: 'System Reset', fields: [] };
    default:
      return { ...base, kind: status >= 0xf8 ? 'realtime' : 'common', name: 'Undefined', summary: `Undefined status ${hex(status)}`, fields: [] };
  }
}

/** Parse a string of hex bytes ("90 3C 64", "0x90,0x3c", "903C64"). */
export function parseHex(input: string): { bytes: number[]; error?: string } {
  const cleaned = input.replace(/0x/gi, ' ').replace(/[,;\[\]]/g, ' ').trim();
  if (!cleaned) return { bytes: [] };
  const tokens = cleaned.split(/\s+/).flatMap((t) => (t.length > 2 && t.length % 2 === 0 ? t.match(/../g)! : [t]));
  const bytes: number[] = [];
  for (const t of tokens) {
    if (!/^[0-9a-f]{1,2}$/i.test(t)) return { bytes, error: `"${t}" is not a hex byte` };
    bytes.push(parseInt(t, 16));
  }
  return { bytes };
}

/**
 * Split a byte stream into messages, applying running status and pulling out
 * interleaved real-time bytes, as a MIDI 1.0 receiver would.
 */
export function parseStream(bytes: number[]): Decoded[] {
  const out: Decoded[] = [];
  let running: number | undefined;
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b >= 0xf8) {
      out.push(decodeMessage([b]));
      i++;
      continue;
    }
    if (b === 0xf0) {
      const msg = [b];
      i++;
      while (i < bytes.length) {
        const c = bytes[i];
        if (c >= 0xf8) { out.push(decodeMessage([c])); i++; continue; }
        if (c === 0xf7) { msg.push(c); i++; break; }
        if (c >= 0x80) break; // any other status byte terminates SysEx
        msg.push(c);
        i++;
      }
      out.push(decodeMessage(msg));
      running = undefined;
      continue;
    }
    let status: number;
    let usedRunning = false;
    if (b >= 0x80) {
      status = b;
      i++;
      running = b < 0xf0 ? b : undefined; // system common cancels running status
    } else if (running !== undefined) {
      status = running;
      usedRunning = true;
    } else {
      out.push(decodeMessage([b]));
      i++;
      continue;
    }
    const need = dataLength(status);
    const msg = [status];
    while (msg.length - 1 < need && i < bytes.length) {
      const c = bytes[i];
      if (c >= 0xf8) { out.push(decodeMessage([c])); i++; continue; }
      if (c >= 0x80) break;
      msg.push(c);
      i++;
    }
    const d = decodeMessage(msg, usedRunning);
    if (usedRunning) d.bytes = msg.slice(1);
    out.push(d);
  }
  return out;
}

/** Encode a non-negative integer (≤ 0x0FFFFFFF) as a Standard MIDI File variable-length quantity. */
export function vlqEncode(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) throw new RangeError('VLQ values must be integers 0–0x0FFFFFFF');
  const out = [value & 0x7f];
  value >>>= 7;
  while (value > 0) {
    out.unshift((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return out;
}

/** Decode a VLQ from the start of `bytes`. */
export function vlqDecode(bytes: number[]): { value: number; length: number; error?: string } {
  let value = 0;
  for (let i = 0; i < bytes.length && i < 4; i++) {
    value = (value << 7) | (bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) return { value: value >>> 0, length: i + 1 };
  }
  return { value, length: Math.min(bytes.length, 4), error: bytes.length >= 4 ? 'VLQ longer than 4 bytes' : 'Unterminated VLQ (last byte has bit 7 set)' };
}
