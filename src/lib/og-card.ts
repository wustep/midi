/**
 * Open Graph cards (1200×630 PNG), one per site section, rendered at build time with satori (layout + text
 * to SVG) and resvg (SVG to PNG). The counts on each card are passed in from the live data, so a card never
 * disagrees with the site. Served by src/pages/og/[section].png.ts; Base.astro points og:image at it.
 *
 * satori reads static TTF/OTF only, so src/og/fonts/ holds instanced, Latin-subset copies of the site fonts
 * (see CONTRIBUTING.md, "Social images and fonts").
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { iconDocument } from './icons.mjs';
import { DEFAULT_THEME } from '../themes/registry.ts';

export const SECTIONS = ['home', 'docs', 'tools', 'reader', 'libraries', 'samples', 'community'] as const;
export type Section = (typeof SECTIONS)[number];

export interface Counts {
  libraries: number;
  languages: number;
  categories: number;
  tools: number;
  chapters: number;
  terms: number;
  controllers: number;
  instruments: number;
  /** Self-hosted instrument audio, in bytes. */
  audioBytes: number;
  sampleSources: number;
  communities: number;
  midiFileSources: number;
  demos: number;
}

type ByteKind = 'status' | 'data' | 'meta';
export interface Card {
  kicker: string;
  title: string;
  sub: string;
  bytes: [string, ByteKind][];
  stats: [number | string, string][];
  path: string;
}

const fmt = (n: number | string) => (typeof n === 'number' ? n.toLocaleString('en-US') : n);

/** Copy for each card. Every number comes from `c`; nothing is hard-coded or rounded. */
export function cardFor(section: Section, c: Counts): Card {
  const cards: Record<Section, Omit<Card, 'path'>> = {
    home: {
      kicker: 'midi.community',
      title: 'The field guide to MIDI.',
      sub: 'Byte-level docs, browser tools and a catalog of libraries checked against their repositories.',
      bytes: [['90', 'status'], ['3C', 'data'], ['64', 'data']],
      stats: [[c.chapters, 'doc chapters'], [c.tools, 'browser tools'], [c.libraries, 'libraries']],
    },
    docs: {
      kicker: 'Docs',
      title: 'How MIDI actually works',
      sub: 'From the 3-byte Note On to MIDI 2.0 packets, explained byte by byte.',
      bytes: [['B0', 'status'], ['40', 'data'], ['7F', 'data']],
      stats: [[c.chapters, 'chapters'], [c.terms, 'glossary terms'], [c.controllers, 'CCs documented']],
    },
    tools: {
      kicker: 'Tools',
      title: 'MIDI tools in your browser',
      sub: 'Inspect files and streams, build SysEx and RPNs, look up CCs and chords.',
      bytes: [['F0', 'status'], ['41', 'meta'], ['F7', 'status']],
      stats: [[c.tools, 'tools'], [c.controllers, 'CCs documented'], [0, 'bytes uploaded']],
    },
    reader: {
      kicker: 'MIDI Reader',
      title: 'What’s inside your .mid file?',
      sub: 'Tracks, tempo, controllers, SysEx, a piano roll, and every byte.',
      bytes: [['4D', 'meta'], ['54', 'meta'], ['68', 'meta'], ['64', 'meta']],
      stats: [[c.instruments, 'sampled instruments'], [c.demos, 'demo files'], [0, 'bytes uploaded']],
    },
    libraries: {
      kicker: 'Libraries',
      title: 'Open-source MIDI libraries',
      sub: 'Every entry checked against its repository: stars, license, last push.',
      bytes: [['C0', 'status'], ['00', 'data']],
      stats: [[c.libraries, 'projects'], [c.languages, 'languages'], [c.categories, 'categories']],
    },
    samples: {
      kicker: 'Samples',
      title: 'Play free instruments',
      sub: 'Openly licensed sounds in the browser, plus SoundFont and SFZ libraries.',
      bytes: [['99', 'status'], ['24', 'data'], ['7F', 'data']],
      stats: [[c.instruments, 'instruments'], [(c.audioBytes / 1e6).toFixed(1), 'MB of audio'], [c.sampleSources, 'more libraries']],
    },
    community: {
      kicker: 'Community',
      title: 'Where MIDI people talk',
      sub: 'Forums, subreddits, Discords and lists, plus where to get MIDI files.',
      bytes: [['F8', 'status'], ['F8', 'status'], ['F8', 'status']],
      stats: [[c.communities, 'communities'], [c.midiFileSources, 'MIDI file sources']],
    },
  };
  return { ...cards[section], path: section === 'home' ? '' : `/${section}` };
}

/* ── Rendering ─────────────────────────────────────────────────────────────────────────────── */

const W = 1200;
const H = 630;
const PAD_X = 72;
// Colors follow the default theme (its light palette, if it has one), so the cards match the site.
const P = (DEFAULT_THEME.light ?? DEFAULT_THEME.dark)!;
const INK = P.ink;
const INK_2 = P['ink-2'];
const MUTED = P.muted;
const RULE = P.line;
const BG = P.bg;
const ACCENT = P.accent;
const BYTE: Record<ByteKind, { bg: string; fg: string }> = {
  status: { bg: P['accent-soft'], fg: P.accent },
  data: { bg: P['data-soft'], fg: P.data },
  meta: { bg: P['meta-soft'], fg: P.meta },
};

// The DIN-5 socket mark from the icon set, with pin 2 in the accent color as in the site header.
const DIN = iconDocument('din', INK).replace(/(<circle class="pin2"[^>]*fill=")[^"]*/, `$1${ACCENT}`);

/** Minimal element factory in the shape satori expects (no JSX in .ts files). */
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

function tree(card: Card): Node {
  return h(
    'div',
    {
      width: W,
      height: H,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      padding: `56px ${PAD_X}px 0`,
      backgroundColor: BG,
      backgroundImage: 'radial-gradient(circle at 92% 8%, rgba(168, 53, 8, 0.09), rgba(168, 53, 8, 0) 42%)',
      color: INK,
      fontFamily: 'Atkinson',
    },
    // Brand row, with the page URL right-aligned.
    h(
      'div',
      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
      h(
        'div',
        { display: 'flex', alignItems: 'center' },
        { type: 'img', props: { src: `data:image/svg+xml;utf8,${encodeURIComponent(DIN)}`, width: 44, height: 44 } },
        h('div', { marginLeft: 14, fontFamily: 'Archivo Expanded', fontWeight: 900, fontSize: 30 }, 'MIDI'),
        h('div', { marginLeft: 12, marginTop: 4, fontFamily: 'Archivo', fontWeight: 500, fontSize: 18, letterSpacing: '0.1em', color: MUTED }, 'FIELD GUIDE'),
      ),
      h('div', { fontFamily: 'Mono', fontSize: 22, color: MUTED }, `midi.community${card.path}`),
    ),
    // Headline block and byte tiles.
    h(
      'div',
      { display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between' },
      h(
        'div',
        { display: 'flex', flexDirection: 'column', width: 720 },
        h('div', { fontFamily: 'Archivo SemiExpanded', fontWeight: 700, fontSize: 22, letterSpacing: '0.14em', color: ACCENT }, card.kicker.toUpperCase()),
        h('div', { marginTop: 14, fontFamily: 'Archivo Expanded', fontWeight: 900, fontSize: 72, lineHeight: 1, letterSpacing: '-0.03em' }, card.title),
        h('div', { marginTop: 22, fontSize: 27, lineHeight: 1.35, color: INK_2, width: 660 }, card.sub),
      ),
      h(
        'div',
        { display: 'flex', flexDirection: 'column' },
        ...card.bytes.map(([b, kind], i) =>
          h(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 200,
              height: card.bytes.length > 3 ? 58 : 72,
              marginTop: i ? 12 : 0,
              borderRadius: 14,
              backgroundColor: BYTE[kind].bg,
              color: BYTE[kind].fg,
              fontFamily: 'Mono',
              fontWeight: 700,
              fontSize: 44,
            },
            b,
          ),
        ),
      ),
    ),
    // Live counts.
    h(
      'div',
      { display: 'flex', borderTop: `2px solid ${RULE}`, padding: '26px 0 40px' },
      ...card.stats.map(([n, label], i) =>
        h(
          'div',
          { display: 'flex', alignItems: 'baseline', marginLeft: i ? 56 : 0 },
          h('div', { fontFamily: 'Mono', fontWeight: 700, fontSize: 40, color: INK }, fmt(n)),
          h('div', { marginLeft: 12, fontSize: 22, color: MUTED }, label),
        ),
      ),
    ),
  );
}

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 700 | 900; style: 'normal' }[]> | undefined;
function loadFonts() {
  const dir = join(process.cwd(), 'src/og/fonts');
  const f = async (file: string, name: string, weight: 400 | 500 | 700 | 900) => ({ name, weight, style: 'normal' as const, data: await readFile(join(dir, file)) });
  return (fonts ??= Promise.all([
    f('archivo-expanded-black.ttf', 'Archivo Expanded', 900),
    f('archivo-semiexpanded-bold.ttf', 'Archivo SemiExpanded', 700),
    f('archivo-medium.ttf', 'Archivo', 500),
    f('atkinson-next-regular.ttf', 'Atkinson', 400),
    f('atkinson-mono-regular.ttf', 'Mono', 400),
    f('atkinson-mono-bold.ttf', 'Mono', 700),
  ]));
}

export async function renderCard(card: Card): Promise<Buffer> {
  const svg = await satori(tree(card) as Parameters<typeof satori>[0], { width: W, height: H, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
