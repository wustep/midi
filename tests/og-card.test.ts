import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, cardFor, renderCard, type Counts } from '../src/lib/og-card.ts';

const counts: Counts = {
  libraries: 481, languages: 33, categories: 13, tools: 12, chapters: 17, terms: 70, controllers: 89,
  instruments: 12, audioBytes: 2_700_000, sampleSources: 36, communities: 98, midiFileSources: 41, demos: 3,
};

test('cards carry the live counts, unrounded', () => {
  assert.deepEqual(cardFor('libraries', counts).stats[0], [481, 'projects']);
  assert.deepEqual(cardFor('home', counts).stats.map(([n]) => n), [17, 12, 481]);
  assert.equal(cardFor('home', counts).path, '');
  assert.equal(cardFor('docs', counts).path, '/docs');
  for (const s of SECTIONS) assert.ok(cardFor(s, counts).stats.length >= 2, s);
});

test('renders a 1200×630 PNG', async () => {
  const png = await renderCard(cardFor('home', counts));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
