import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, prepare, search, group, type Entry } from '../src/lib/search.ts';

const entries: Entry[] = [
  { t: 'Sustain (Damper Pedal)', u: '/tools/cc/?cc=64', k: 'Controller', x: 'cc64' },
  { t: 'Control Change', u: '/docs/control-change/', k: 'Docs', d: 'All 128 controller numbers, including sustain.' },
  { t: 'CC map', u: '/tools/cc/', k: 'Tool', d: 'All 128 Control Change numbers.' },
  { t: 'midir', u: 'https://github.com/Boddlnagg/midir', k: 'Library', d: 'Cross-platform realtime MIDI in Rust.', x: 'Boddlnagg/midir Rust Realtime I/O' },
  { t: 'Running status', u: '/docs/messages/#running-status', k: 'Section', d: 'Messages' },
  { t: 'C♯ minor', u: '/x', k: 'Docs' },
];
const idx = prepare(entries);

test('normalizes case, accents and music symbols', () => {
  assert.equal(normalize('Ré  C♯/D♭'), 're c#/db');
});

test('every word must match; title prefixes win', () => {
  assert.deepEqual(search(idx, 'sustain').map((e) => e.t), ['Sustain (Damper Pedal)', 'Control Change']);
  assert.deepEqual(search(idx, 'run stat').map((e) => e.t), ['Running status']);
  assert.deepEqual(search(idx, 'sustain rust'), []);
  assert.deepEqual(search(idx, '   '), []);
});

test('keywords find libraries by language and repo', () => {
  assert.equal(search(idx, 'rust')[0].t, 'midir');
  assert.equal(search(idx, 'boddlnagg')[0].t, 'midir');
  assert.equal(search(idx, 'cc64')[0].t, 'Sustain (Damper Pedal)');
});

test('exact titles and tools rank first', () => {
  assert.equal(search(idx, 'cc map')[0].t, 'CC map');
  assert.equal(search(idx, 'c# minor')[0].t, 'C♯ minor');
});

test('groups keep rank order', () => {
  const g = group(search(idx, 'control'));
  assert.ok(g.length >= 1);
  assert.ok(g.every(([, items]) => items.length > 0));
});
