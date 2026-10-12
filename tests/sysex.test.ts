import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rolandChecksum, xorChecksum, to7bit, from7bit, toNibbles, pack8to7, unpack7to8, parseBytes, buildSysex, manufacturerOf } from '../src/lib/sysex.ts';

test('Roland checksum matches the GS Reset message', () => {
  // F0 41 10 42 12 40 00 7F 00 41 F7
  assert.equal(rolandChecksum([0x40, 0x00, 0x7f, 0x00]), 0x41);
  // (sum + checksum) is always a multiple of 128
  for (const data of [[0], [0x7f, 0x7f, 0x7f], [0x40, 0x01, 0x30, 0x05]]) {
    assert.equal((data.reduce((a, b) => a + b, 0) + rolandChecksum(data)) % 128, 0);
  }
  assert.equal(rolandChecksum([]), 0);
});

test('XOR checksum', () => {
  assert.equal(xorChecksum([0x01, 0x02, 0x04]), 0x07);
  assert.equal(xorChecksum([0x7f, 0x7f]), 0);
});

test('7-bit and nibble splitting', () => {
  assert.deepEqual(to7bit(16383, 2), [0x7f, 0x7f]);
  assert.deepEqual(to7bit(8192, 2), [0x40, 0x00]);
  assert.deepEqual(to7bit(300, 3), [0x00, 0x02, 0x2c]);
  assert.equal(from7bit([0x02, 0x2c]), 300);
  assert.throws(() => to7bit(128, 1), RangeError);
  assert.throws(() => to7bit(-1, 2), RangeError);
  assert.deepEqual(toNibbles(0xab, 2), [0x0a, 0x0b]);
});

test('8-to-7 packing round-trips arbitrary bytes and stays 7-bit clean', () => {
  const data = Array.from({ length: 23 }, (_, i) => (i * 37 + 200) & 0xff);
  const packed = pack8to7(data);
  assert.equal(packed.length, 23 + Math.ceil(23 / 7));
  assert.ok(packed.every((b) => b <= 0x7f));
  assert.deepEqual(unpack7to8(packed), data);
  assert.deepEqual(pack8to7([0x80]), [0x01, 0x00]);
});

test('parses hex and decimal input', () => {
  assert.deepEqual(parseBytes('41 10 0x42,12').bytes, [0x41, 0x10, 0x42, 0x12]);
  assert.deepEqual(parseBytes('4110').bytes, [0x41, 0x10]);
  assert.deepEqual(parseBytes('65 16 0x7F', 10).bytes, [65, 16, 127]);
  assert.match(parseBytes('zz').error!, /not a hex byte/);
  assert.match(parseBytes('300', 10).error!, /larger than 255/);
  assert.deepEqual(parseBytes('  ').bytes, []);
});

test('builds a GS Reset with a Roland checksum over address + data', () => {
  const m = buildSysex({ id: [0x41], header: [0x10, 0x42, 0x12], data: [0x40, 0x00, 0x7f, 0x00], checksum: 'roland' });
  assert.deepEqual(m.bytes, [0xf0, 0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7f, 0x00, 0x41, 0xf7]);
  assert.deepEqual(m.problems, []);
  assert.deepEqual(m.parts.map((p) => p.label), ['Start of Exclusive', 'Manufacturer ID', 'Header', 'Data', 'Checksum', 'End of Exclusive']);
  assert.equal(m.parts.at(-1)!.end, m.bytes.length);
});

test('flags invalid IDs and 8-bit payload bytes', () => {
  assert.match(buildSysex({ id: [0x00, 0x20] }).problems[0], /3 bytes/);
  assert.match(buildSysex({ id: [] }).problems[0], /required/);
  assert.match(buildSysex({ id: [0x43], data: [0x90] }).problems[0], /≥ 0x80/);
  assert.deepEqual(buildSysex({ id: [0x7e], header: [0x7f, 0x06, 0x01] }).bytes, [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
});

test('looks up manufacturers', () => {
  assert.equal(manufacturerOf([0x41, 0x10])!.name, 'Roland');
  assert.equal(manufacturerOf([0x00, 0x20, 0x29, 0x02])!.name, 'Focusrite / Novation');
  assert.equal(manufacturerOf([0x00, 0x20])!.name, undefined);
  assert.equal(manufacturerOf([]), null);
});
