import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CCS, ccBytes, cc14Bytes, rpnBytes, filterCcs } from '../src/lib/cc.ts';
import { ccName } from '../src/lib/midi.ts';

test('covers all 128 controllers in order', () => {
  assert.equal(CCS.length, 128);
  CCS.forEach((c, i) => assert.equal(c.number, i));
});

test('agrees with the decoder’s controller names', () => {
  for (const c of CCS) {
    const short = ccName(c.number);
    if (short === 'Undefined') assert.equal(c.kind, 'undefined', `CC ${c.number}`);
    else assert.notEqual(c.kind, 'undefined', `CC ${c.number}`);
  }
});

test('structure: LSB pairs, switches, mode messages, GM sets', () => {
  for (let n = 32; n < 64; n++) assert.equal(CCS[n].kind, 'lsb');
  for (let n = 64; n < 70; n++) assert.equal(CCS[n].kind, 'switch');
  for (let n = 120; n < 128; n++) assert.equal(CCS[n].kind, 'mode');
  assert.deepEqual(CCS.filter((c) => c.gm1).map((c) => c.number), [1, 6, 7, 10, 11, 64, 100, 101, 121, 123]);
  assert.ok(CCS.filter((c) => c.gm2).length > CCS.filter((c) => c.gm1).length);
  assert.equal(CCS[7].default!.value, 100);
  assert.equal(CCS[38].name, 'LSB for CC 6 (Data Entry)');
});

test('builds CC, 14-bit and RPN messages', () => {
  assert.deepEqual(ccBytes(1, 74, 64), [0xb0, 74, 64]);
  assert.deepEqual(ccBytes(16, 7, 100), [0xbf, 7, 100]);
  assert.throws(() => ccBytes(0, 7, 1), RangeError);
  assert.throws(() => ccBytes(1, 128, 1), RangeError);
  assert.deepEqual(cc14Bytes(1, 1, 8192), [0xb0, 1, 64, 0xb0, 33, 0]);
  assert.throws(() => cc14Bytes(1, 40, 0), RangeError);
  // Pitch bend sensitivity = 12 semitones: 101/100 = 0/0, data entry 12/0, then null RPN.
  assert.deepEqual(rpnBytes(1, 0, 0, 12 << 7), [0xb0, 101, 0, 0xb0, 100, 0, 0xb0, 6, 12, 0xb0, 38, 0, 0xb0, 101, 127, 0xb0, 100, 127]);
  assert.deepEqual(rpnBytes(2, 1, 8, 0, true).slice(0, 6), [0xb1, 99, 1, 0xb1, 98, 8]);
});

test('filters by text, number and kind', () => {
  assert.deepEqual(filterCcs('74', 'all').map((c) => c.number), [74]);
  assert.deepEqual(filterCcs('0x4A', 'all').map((c) => c.number), [74]);
  assert.ok(filterCcs('reverb', 'all').some((c) => c.number === 91));
  assert.ok(filterCcs('cutoff', 'all').some((c) => c.number === 74));
  assert.equal(filterCcs('', 'mode').length, 8);
  assert.equal(filterCcs('', 'gm1').length, 10);
});

import { matches } from '../src/lib/list-filter.ts';

test('list filter matching: every word, optional tag', () => {
  assert.equal(matches('juce forum for plugin developers', ['developers'], 'juce plugin', ''), true);
  assert.equal(matches('juce forum', ['developers'], 'juce linux', ''), false);
  assert.equal(matches('juce forum', ['developers'], '', 'developers'), true);
  assert.equal(matches('juce forum', ['developers'], '', 'Linux'), false);
  assert.equal(matches('anything', [], '  ', ''), true);
});
