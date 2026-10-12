import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MpeState, zoneMembers, mcmBytes, simulateFrame } from '../src/lib/mpe.ts';

const feed = (m: MpeState, bytes: number[]) => {
  for (let i = 0; i < bytes.length; i += 3) m.handle(bytes.slice(i, i + 3));
};

test('zone members count up from channel 2 (lower) and down from channel 15 (upper)', () => {
  assert.deepEqual(zoneMembers(0, 3), [1, 2, 3]);
  assert.deepEqual(zoneMembers(15, 3), [14, 13, 12]);
  assert.deepEqual(mcmBytes(true, 15), [0xb0, 101, 0, 0xb0, 100, 6, 0xb0, 6, 15, 0xb0, 101, 127, 0xb0, 100, 127]);
});

test('MPE Configuration Message sets zones; a full lower zone removes the upper zone', () => {
  const m = new MpeState(false);
  feed(m, mcmBytes(true, 7));
  feed(m, mcmBytes(false, 7));
  assert.deepEqual(m.zones.map((z) => [z.manager, z.members.length]), [[0, 7], [15, 7]]);
  feed(m, mcmBytes(true, 15));
  assert.deepEqual(m.zones.map((z) => [z.manager, z.members.length]), [[0, 15]]);
  feed(m, mcmBytes(true, 0));
  assert.deepEqual(m.zones, []);
});

test('per-note pitch uses the member channel bend (48 semitones by default) plus the manager bend', () => {
  const m = new MpeState();
  const n = m.handle([0x91, 60, 100])!;
  assert.equal(n.pitch, 60);
  m.handle([0xe1, 0, 0x50]); // +2048/8192 of 48 = +12
  assert.equal(n.pitch, 72);
  m.handle([0xe0, 0, 0x60]); // manager: +0.5 of 2 = +1
  assert.equal(n.pitch, 73);
  // A note on another member channel is unaffected by channel 2's bend.
  const n2 = m.handle([0x92, 64, 90])!;
  assert.equal(n2.pitch, 65);
});

test('pressure, timbre and release are per note', () => {
  const m = new MpeState();
  const a = m.handle([0x91, 60, 100])!;
  const b = m.handle([0x92, 67, 100])!;
  m.handle([0xd1, 127]);
  m.handle([0xb2, 74, 0]);
  assert.equal(a.pressure, 1);
  assert.equal(b.pressure, 0);
  assert.equal(b.timbre, 0);
  assert.equal(a.timbre, 0.5);
  m.handle([0x81, 60, 30]);
  assert.equal(a.released, true);
  assert.equal(a.releaseVelocity, 30);
  assert.equal(b.released, false);
});

test('pitch bend range RPN on a member channel applies to the whole zone', () => {
  const m = new MpeState();
  feed(m, [0xb3, 101, 0, 0xb3, 100, 0, 0xb3, 6, 24]);
  assert.equal(m.bendRangeOf(1), 24);
  assert.equal(m.bendRangeOf(14), 24);
  assert.equal(m.bendRangeOf(0), 2);
  const n = m.handle([0x95, 60, 100])!;
  m.handle([0xe5, 0x7f, 0x7f]);
  assert.ok(Math.abs(n.pitch - (60 + 24 * (8191 / 8192))) < 1e-9);
});

test('simulator emits bend, pressure and timbre in range', () => {
  const frames = simulateFrame([{ channel: 3, note: 60, start: 0, length: 2000, glide: 5, vibrato: 0.3 }], 1000);
  assert.equal(frames.length, 3);
  for (const f of frames) for (const b of f.slice(1)) assert.ok(b >= 0 && b <= 127);
  assert.equal(frames[0][0], 0xe3);
  assert.equal(simulateFrame([{ channel: 3, note: 60, start: 0, length: 100, glide: 0, vibrato: 0 }], 500).length, 0);
});
