import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RPNS, findRpn, buildParam, flatten, encodeValue, describeValue, decodeParams, splitMessages } from '../src/lib/rpn.ts';
import { rpnBytes } from '../src/lib/cc.ts';

test('catalog has the core RPNs and no duplicates', () => {
  assert.equal(findRpn(0, 0)!.name, 'Pitch Bend Sensitivity');
  assert.equal(findRpn(0, 6)!.name, 'MPE Configuration Message');
  assert.equal(findRpn(127, 127)!.name, 'RPN Null');
  assert.equal(new Set(RPNS.map((r) => `${r.msb}:${r.lsb}`)).size, RPNS.length);
});

test('builds a pitch bend range write that matches the CC map helper', () => {
  const v = encodeValue(findRpn(0, 0)!, 12, 0);
  const msgs = buildParam({ channel: 1, msb: 0, lsb: 0, value: v });
  assert.deepEqual(flatten(msgs), rpnBytes(1, 0, 0, 12 << 7));
  assert.deepEqual(flatten(msgs, true), [0xb0, 101, 0, 100, 0, 6, 12, 38, 0, 101, 127, 100, 127]);
});

test('value units', () => {
  assert.equal(encodeValue({ unit: 'cents14' }, 0), 8192);
  assert.equal(encodeValue({ unit: 'cents14' }, -100), 0);
  assert.equal(encodeValue({ unit: 'semitones-centered' }, -12), 52 << 7);
  assert.equal(describeValue({ unit: 'semitones-centered' }, 52 << 7), '-12 semitones');
  assert.equal(describeValue({ unit: 'semitones+cents' }, (2 << 7) | 50), '2 semitones 50 cents');
  assert.equal(describeValue({ unit: 'cents14' }, 12288), '+50.00 cents');
  assert.equal(describeValue({ unit: 'members' }, 0), 'zone off');
});

test('NRPN, MSB-only, increments, no null', () => {
  assert.deepEqual(buildParam({ channel: 2, nrpn: true, msb: 1, lsb: 8, value: 64, msbOnly: true, nullAfter: false }), [[0xb1, 99, 1], [0xb1, 98, 8], [0xb1, 6, 64]]);
  assert.deepEqual(buildParam({ channel: 1, msb: 0, lsb: 0, value: 0, steps: -2, nullAfter: false }).slice(2), [[0xb0, 97, 0], [0xb0, 97, 0]]);
  assert.throws(() => buildParam({ channel: 17, msb: 0, lsb: 0, value: 0 }), RangeError);
  assert.throws(() => buildParam({ channel: 1, msb: 0, lsb: 0, value: 20000 }), RangeError);
});

test('decodes the parameter state machine like a receiver', () => {
  const stream = [
    [0xb0, 6, 5], // ignored: nothing selected
    ...buildParam({ channel: 1, msb: 0, lsb: 0, value: (24 << 7) }),
    [0xb0, 6, 3], // ignored: null RPN selected
    ...buildParam({ channel: 3, nrpn: true, msb: 5, lsb: 9, value: 1000, nullAfter: false }),
    [0xb2, 96, 0],
  ];
  const r = decodeParams(stream);
  assert.deepEqual(r.ignored, [0, 7]);
  assert.deepEqual(r.writes.map((w) => [w.channel, w.nrpn, w.msb, w.lsb, w.value, w.via, w.name]), [
    [1, false, 0, 0, 24 << 7, 'msb', 'Pitch Bend Sensitivity'],
    [1, false, 0, 0, 24 << 7, 'lsb', 'Pitch Bend Sensitivity'],
    [3, true, 5, 9, 7 << 7, 'msb', undefined],
    [3, true, 5, 9, 1000, 'lsb', undefined],
    [3, true, 5, 9, 1001, 'inc', undefined],
  ]);
});

test('splits running-status byte streams', () => {
  assert.deepEqual(splitMessages([0xb0, 101, 0, 100, 0, 0xf8, 6, 12, 0xc0, 5]), [[0xb0, 101, 0], [0xb0, 100, 0], [0xb0, 6, 12], [0xc0, 5]]);
});
