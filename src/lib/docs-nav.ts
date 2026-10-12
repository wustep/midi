export interface DocLink {
  slug: string;
  title: string;
  /** One-line summary shown on the docs index. */
  summary: string;
}

export interface DocGroup {
  title: string;
  items: DocLink[];
}

export const docGroups: DocGroup[] = [
  {
    title: 'MIDI 1.0',
    items: [
      { slug: 'messages', title: 'Messages', summary: 'Status and data bytes, channel voice & mode messages, system common & real-time, running status.' },
      { slug: 'notes', title: 'Notes & Pitch', summary: 'Note numbers, octave naming, frequencies, velocity, and pitch bend math.' },
      { slug: 'control-change', title: 'Control Change', summary: 'All 128 controller numbers, 14-bit pairs, and channel mode messages.' },
      { slug: 'rpn-nrpn', title: 'RPN & NRPN', summary: 'Registered and non-registered parameter numbers, data entry, and the null RPN.' },
      { slug: 'sysex', title: 'System Exclusive', summary: 'Manufacturer IDs, Universal SysEx, device inquiry, and checksums.' },
      { slug: 'timing', title: 'Timing & Sync', summary: 'MIDI clock, Song Position Pointer, MIDI Time Code, and tempo math.' },
    ],
  },
  {
    title: 'Files & Sounds',
    items: [
      { slug: 'smf', title: 'Standard MIDI Files', summary: 'Header and track chunks, delta times, variable-length quantities, meta events.' },
      { slug: 'general-midi', title: 'General MIDI', summary: 'GM program list, percussion key map, and the GM/GS/XG landscape.' },
    ],
  },
  {
    title: 'Expression & MIDI 2.0',
    items: [
      { slug: 'mpe', title: 'MPE', summary: 'MIDI Polyphonic Expression: zones, per-note channels, and the MPE Configuration Message.' },
      { slug: 'midi-2', title: 'MIDI 2.0 & UMP', summary: 'Universal MIDI Packet formats, message types, groups, and higher resolution.' },
      { slug: 'midi-ci', title: 'MIDI-CI', summary: 'Capability Inquiry: discovery, profiles, property exchange, process inquiry.' },
    ],
  },
  {
    title: 'Connecting',
    items: [
      { slug: 'transports', title: 'Transports', summary: '5-pin DIN and TRS, USB-MIDI 1.0/2.0, BLE-MIDI, RTP-MIDI and network MIDI.' },
    ],
  },
];

export const docsFlat: DocLink[] = docGroups.flatMap((g) => g.items);
