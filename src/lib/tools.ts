/** Registry of interactive tools: drives the tools hub, per-tool pages, and the home page. */
/** Tools are grouped by what you're trying to do. */
export const TOOL_GROUPS = ['Inspect', 'Build & send', 'Look up', 'Calculate'] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export interface Tool {
  slug: string;
  href: string;
  title: string;
  /** One line for cards. */
  blurb: string;
  /** Short input → output example shown on cards. */
  demo: [string, string];
  /** Background reading. */
  docs: { label: string; href: string }[];
  group: ToolGroup;
}

const registry: Tool[] = [
  {
    slug: 'reader', href: '/reader/', title: 'MIDI Reader', group: 'Inspect',
    blurb: 'Open a .mid file and see every part explained: tracks, tempo map, controllers, SysEx, a piano roll, and the raw bytes. Play it with sampled instruments.',
    demo: ['song.mid', '4 tracks · 3:12 · 120 BPM'],
    docs: [{ label: 'Standard MIDI Files', href: '/docs/smf/' }, { label: 'General MIDI', href: '/docs/general-midi/' }, { label: 'Getting MIDI files', href: '/community/midi-files/' }],
  },
  {
    slug: 'sysex', href: '/tools/sysex/', title: 'SysEx builder', group: 'Build & send',
    blurb: 'Assemble System Exclusive messages with manufacturer IDs, Roland checksums and 7-bit value encoding.',
    demo: ['GS Reset', 'F0 41 10 42 12 … 41 F7'],
    docs: [{ label: 'System Exclusive', href: '/docs/sysex/' }],
  },
  {
    slug: 'monitor', href: '/tools/monitor/', title: 'Web MIDI monitor', group: 'Inspect',
    blurb: 'Plug in a controller and watch every incoming message decoded live, with a keyboard view and meters.',
    demo: ['your keyboard', 'Note On C4 vel 100'],
    docs: [{ label: 'Messages', href: '/docs/messages/' }, { label: 'Transports', href: '/docs/transports/' }],
  },
  {
    slug: 'clock', href: '/tools/clock/', title: 'Clock & latency tester', group: 'Inspect',
    blurb: 'Measure the tempo and jitter of incoming MIDI clock, send clock to a device, and time a round trip through a loopback.',
    demo: ['F8 F8 F8 …', '120.0 BPM · ±0.3 ms'],
    docs: [{ label: 'Timing & Sync', href: '/docs/timing/' }, { label: 'Transports', href: '/docs/transports/' }],
  },
  {
    slug: 'mpe', href: '/tools/mpe/', title: 'MPE playground', group: 'Build & send',
    blurb: 'See per-note pitch bend, pressure and timbre from an MPE controller, or watch a simulated performance. Shows zones and every message.',
    demo: ['ch 2–16', 'C4 +1.25 st · pressure 96'],
    docs: [{ label: 'MPE', href: '/docs/mpe/' }],
  },
  {
    slug: 'rpn', href: '/tools/rpn/', title: 'RPN & NRPN builder', group: 'Build & send',
    blurb: 'Build the Control Change sequence that sets a registered or non-registered parameter, with friendly units, and decode pasted parameter streams.',
    demo: ['Bend range ±12', 'B0 65 00 64 00 06 0C …'],
    docs: [{ label: 'RPN & NRPN', href: '/docs/rpn-nrpn/' }, { label: 'Control Change', href: '/docs/control-change/' }],
  },
  {
    slug: 'cc', href: '/tools/cc/', title: 'CC map', group: 'Look up',
    blurb: 'All 128 Control Change numbers: what the spec, GM and GM2 say, how synths use them, and the bytes to send. Move a knob to find its number.',
    demo: ['CC 74', 'Brightness · B0 4A 40'],
    docs: [{ label: 'Control Change', href: '/docs/control-change/' }, { label: 'RPN & NRPN', href: '/docs/rpn-nrpn/' }],
  },
  {
    slug: 'chords', href: '/tools/chords/', title: 'Chords & scales', group: 'Look up',
    blurb: 'Correctly spelled chords and scales with MIDI note numbers. Hear them with sampled instruments, send them to a synth, or play one to name it.',
    demo: ['Am7', 'A C E G · 57 60 64 67'],
    docs: [{ label: 'Notes & Pitch', href: '/docs/notes/' }],
  },
  {
    slug: 'decoder', href: '/tools/decoder/', title: 'Message decoder', group: 'Inspect',
    blurb: 'Paste raw bytes and see each message decoded, running status and real-time bytes included.',
    demo: ['B0 40 7F', 'CC 64 Sustain = on'],
    docs: [{ label: 'Messages', href: '/docs/messages/' }, { label: 'RPN & NRPN', href: '/docs/rpn-nrpn/' }, { label: 'SysEx', href: '/docs/sysex/' }],
  },
  {
    slug: 'vlq', href: '/tools/vlq/', title: 'VLQ encoder', group: 'Calculate',
    blurb: 'Convert delta-times and lengths to and from Standard MIDI File variable-length quantities.',
    demo: ['480', '83 60'],
    docs: [{ label: 'Standard MIDI Files', href: '/docs/smf/#vlq' }],
  },
  {
    slug: 'tempo', href: '/tools/tempo/', title: 'Tempo calculator', group: 'Calculate',
    blurb: 'BPM, microseconds per quarter note, ticks, and MIDI clock intervals.',
    demo: ['120 BPM', 'FF 51 03 07 A1 20'],
    docs: [{ label: 'Timing & Sync', href: '/docs/timing/' }],
  },
  {
    slug: 'notes', href: '/tools/notes/', title: 'Note table', group: 'Look up',
    blurb: 'All 128 note numbers with names, frequencies and GM drum sounds. Click to hear.',
    demo: ['69 · A4', '440.00 Hz'],
    docs: [{ label: 'Notes & Pitch', href: '/docs/notes/' }, { label: 'General MIDI', href: '/docs/general-midi/' }],
  },
];

const ORDER = ['reader', 'monitor', 'decoder', 'clock', 'sysex', 'rpn', 'mpe', 'cc', 'chords', 'notes', 'tempo', 'vlq'];

/** All tools, ordered by group and then by usefulness within the group. */
export const tools: Tool[] = [...registry].sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));

export const toolBySlug = (slug: string) => tools.find((t) => t.slug === slug)!;
