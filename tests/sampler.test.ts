import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSample, playable, velocityGain, KEYMAP } from '../src/lib/sampler.ts';

const inst = { notes: [48, 60, 72], range: [41, 79] as [number, number] };

test('picks the nearest recorded note and repitches it', () => {
  assert.deepEqual(pickSample(inst, 60), { sample: 60, rate: 1 });
  assert.equal(pickSample(inst, 62)!.sample, 60);
  assert.ok(Math.abs(pickSample(inst, 62)!.rate - 2 ** (2 / 12)) < 1e-12);
  assert.equal(pickSample(inst, 79)!.sample, 72);
  // Equidistant (54 is 6 from 48 and 60): repitch down from the higher sample.
  assert.equal(pickSample(inst, 54)!.sample, 60);
  assert.ok(pickSample(inst, 54)!.rate < 1);
  assert.equal(pickSample({ notes: [] }, 60), null);
});

test('drum kits only play mapped keys, unpitched', () => {
  const kit = { notes: [36, 38, 42], range: [0, 127] as [number, number], drumMap: { '36': 'Kick', '38': 'Snare', '42': 'Hat' } };
  assert.deepEqual(pickSample(kit, 38), { sample: 38, rate: 1 });
  assert.equal(pickSample(kit, 40), null);
  assert.equal(playable(kit, 40), false);
  assert.equal(playable(kit, 42), true);
});

test('range limits', () => {
  assert.equal(playable(inst, 40), false);
  assert.equal(playable(inst, 41), true);
  assert.equal(playable(inst, 80), false);
});

test('velocity curve is monotonic and bounded', () => {
  let prev = -1;
  for (let v = 0; v <= 127; v++) {
    const g = velocityGain(v);
    assert.ok(g > prev && g <= 1);
    prev = g;
  }
  assert.equal(velocityGain(127), 1);
});

test('keymap covers a chromatic run without gaps', () => {
  assert.deepEqual(Object.values(KEYMAP).sort((a, b) => a - b), Array.from({ length: 18 }, (_, i) => i));
});

import { instrumentForProgram, routeNote, DRUM_KIT } from '../src/lib/sampler.ts';
import { readFileSync } from 'node:fs';

const all = JSON.parse(readFileSync(new URL('../data/samples.json', import.meta.url), 'utf8'));
const insts = new Map(all.map((i: { id: string }) => [i.id, i]));

test('every GM program maps to a bundled instrument', () => {
  for (let p = 0; p < 128; p++) assert.ok(insts.has(instrumentForProgram(p)), `program ${p}`);
  assert.equal(instrumentForProgram(0), 'salamander-grand-piano');
  assert.equal(instrumentForProgram(40), 'vsco2-violin-section');
  assert.equal(instrumentForProgram(60), 'vsco2-french-horn');
});

test('routing: drums use the kit with fallbacks, out-of-range notes fall back to piano', () => {
  assert.deepEqual(routeNote(insts as never, 9, 0, 36), { id: DRUM_KIT, note: 36 });
  assert.deepEqual(routeNote(insts as never, 9, 0, 35), { id: DRUM_KIT, note: 36 });
  assert.equal(routeNote(insts as never, 9, 0, 81), null);
  assert.deepEqual(routeNote(insts as never, 0, 40, 70), { id: 'vsco2-violin-section', note: 70 });
  assert.deepEqual(routeNote(insts as never, 0, 40, 30), { id: 'salamander-grand-piano', note: 30 });
  assert.equal(routeNote(insts as never, 0, 40, 120), null);
});
