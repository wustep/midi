/**
 * The site search index, generated at build time from the docs, tools, glossary, CC table and every
 * data file. Served as /search.json and fetched lazily the first time the search palette opens.
 */
import type { APIRoute } from 'astro';
import { docsFlat } from '../lib/docs-nav';
import { tools } from '../lib/tools';
import { terms, termSlug } from '../lib/glossary';
import { CCS } from '../lib/cc';
import type { Entry } from '../lib/search';
import { repoUrl, repoLabel } from '../lib/repo.mjs';
import libraries from '../../data/libraries.json';
import categories from '../../data/categories.json';
import community from '../../data/community.json';
import midiFiles from '../../data/midi-files.json';
import resources from '../../data/resources.json';
import sampleSources from '../../data/sample-sources.json';
import samples from '../../data/samples.json';

const strip = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Section headings of every docs page, read from the page sources.
const sources = import.meta.glob('./docs/*.astro', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Words people search for that a tool's title doesn't contain. */
const TOOL_KEYWORDS: Record<string, string> = {
  reader: 'smf file inspector player viewer piano roll hex convert csv json export transpose',
  sysex: 'system exclusive gs reset xg gm system on identity request roland checksum manufacturer id',
  monitor: 'web midi input live debug sniffer log keyboard',
  clock: 'sync jitter latency tempo bpm loopback round trip timing',
  mpe: 'polyphonic expression seaboard linnstrument osmose continuum per-note pitch bend pressure timbre',
  rpn: 'registered parameter nrpn pitch bend range sensitivity fine coarse tuning data entry',
  cc: 'control change controller sustain mod wheel cutoff midi learn',
  chords: 'chord scale theory mode key diatonic arpeggio inversion',
  decoder: 'decode bytes hex running status parse',
  vlq: 'variable length quantity delta time',
  tempo: 'bpm microseconds per quarter ppq ticks',
  notes: 'note number frequency hz pitch drum map',
};

export const GET: APIRoute = () => {
  const out: Entry[] = [];
  for (const t of tools) out.push({ t: t.title, u: t.href, k: 'Tool', d: t.blurb, x: `${t.slug} ${TOOL_KEYWORDS[t.slug] ?? ''}` });
  out.push({ t: 'Samples', u: '/samples/', k: 'Sounds', d: 'Play openly licensed instruments in the browser and find SoundFonts and SFZ libraries.', x: 'soundfont sf2 sfz piano instruments' });
  out.push({ t: 'Libraries', u: '/libraries/', k: 'Docs', d: `${libraries.length} verified open-source MIDI libraries and tools.`, x: 'catalog awesome list github' });
  out.push({ t: 'Community', u: '/community/', k: 'Docs', d: 'Forums, subreddits, Discord servers and mailing lists.', x: 'forum discord reddit help' });
  out.push({ t: 'Getting MIDI files', u: '/community/midi-files/', k: 'Docs', d: 'Public-domain archives and datasets, with license notes.', x: 'download free midi datasets copyright' });

  for (const d of docsFlat) {
    const url = `/docs/${d.slug}/`;
    out.push({ t: d.title, u: url, k: 'Docs', d: d.summary });
    const src = sources[`./docs/${d.slug}.astro`] ?? '';
    for (const m of src.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const title = strip(m[3]);
      if (!title || /^\{/.test(title) || title.length > 90) continue;
      out.push({ t: title, u: `${url}#${m[2]}`, k: 'Section', d: d.title });
    }
  }
  if (sources['./docs/index.astro']) out.push({ t: 'Docs overview', u: '/docs/', k: 'Docs', d: 'Every chapter of the guide.' });

  for (const [term, def] of terms) out.push({ t: term, u: `/docs/glossary/#${termSlug(term)}`, k: 'Glossary', d: clip(strip(def)) });

  for (const c of CCS) {
    if (c.kind === 'undefined') continue;
    out.push({ t: `CC ${c.number} ${c.name}`, u: `/tools/cc/?cc=${c.number}`, k: 'Controller', d: clip(c.spec ?? c.name), x: `cc${c.number} 0x${c.number.toString(16)} controller ${c.common ?? ''}` });
  }

  const catTitle = Object.fromEntries(categories.map((c) => [c.id, c.title]));
  for (const l of libraries) {
    out.push({ t: l.name, u: repoUrl(l), k: 'Library', d: clip(l.description), x: `${repoLabel(l)} ${l.language} ${catTitle[l.category] ?? ''}` });
  }
  for (const c of community) out.push({ t: c.title, u: c.url, k: 'Community', d: clip(c.description), x: `${c.group} ${((c as { tags?: string[] }).tags ?? []).join(' ')}` });
  for (const f of midiFiles) out.push({ t: f.title, u: f.url, k: 'MIDI files', d: clip(f.description), x: `${f.group} ${f.license}` });
  for (const r of resources) out.push({ t: r.title, u: r.url, k: 'Spec', d: clip(r.description), x: `${r.group} ${r.publisher}` });
  for (const s of sampleSources) out.push({ t: s.title, u: s.url, k: 'Sounds', d: clip(s.description), x: `${s.group} ${s.license} ${s.formats.join(' ')}` });
  for (const s of samples) out.push({ t: `${s.name} (play)`, u: '/samples/', k: 'Sounds', d: s.attribution, x: s.family });

  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
