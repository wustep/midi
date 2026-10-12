/** Social cards, rendered at build time from live counts (see src/lib/og-card.ts). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS, cardFor, renderCard, type Section } from '../../lib/og-card';
import { tools } from '../../lib/tools';
import { docsFlat } from '../../lib/docs-nav';
import { terms } from '../../lib/glossary';
import { CCS } from '../../lib/cc';
import libraries from '../../../data/libraries.json';
import categories from '../../../data/categories.json';
import samples from '../../../data/samples.json';
import sampleSources from '../../../data/sample-sources.json';
import community from '../../../data/community.json';
import midiFiles from '../../../data/midi-files.json';

export const getStaticPaths = (() => SECTIONS.map((section) => ({ params: { section } }))) satisfies GetStaticPaths;

const counts = {
  libraries: libraries.length,
  languages: new Set(libraries.map((l) => l.language)).size,
  categories: categories.length,
  tools: tools.length,
  chapters: docsFlat.length,
  terms: terms.length,
  controllers: CCS.filter((c) => c.kind !== 'undefined').length,
  instruments: samples.length,
  audioBytes: samples.reduce((n, s) => n + s.bytes, 0),
  sampleSources: sampleSources.length,
  communities: community.length,
  midiFileSources: midiFiles.length,
  demos: readdirSync(join(process.cwd(), 'public/demos')).filter((f) => f.endsWith('.mid')).length,
};

export const GET: APIRoute = async ({ params }) => {
  const png = await renderCard(cardFor(params.section as Section, counts));
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
};
