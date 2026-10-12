import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSmf, extractNotes, buildTempoMap, writeSmf, toDeltas, tempoMeta, textMeta } from '../src/lib/smf.ts';
import { exportSmf, toCsv, toJson } from '../src/lib/smf-edit.ts';

const demo = (name: string) => parseSmf(readFileSync(new URL(`../public/demos/${name}`, import.meta.url)));
const duration = (s: ReturnType<typeof parseSmf>) => {
  const tm = buildTempoMap(s);
  return tm.tickToSeconds(Math.max(...s.tracks.map((t) => t.endTick)));
};

test('export all tracks unchanged round-trips events and notes', () => {
  const src = demo('prelude.mid');
  const out = parseSmf(exportSmf(src).bytes);
  assert.deepEqual(out.warnings, []);
  assert.equal(out.tracks.length, src.tracks.length);
  const key = (n: ReturnType<typeof extractNotes>[number]) => `${n.track}:${n.channel}:${n.pitch}:${n.startTick}:${n.endTick}:${n.velocity}`;
  assert.deepEqual(extractNotes(out).map(key), extractNotes(src).map(key));
  out.tracks.forEach((t, i) => assert.equal(t.events.length, src.tracks[i].events.length));
});

test('a single track keeps the tempo map from the conductor track', () => {
  const src = demo('prelude.mid');
  const out = parseSmf(exportSmf(src, { tracks: [1] }).bytes);
  assert.equal(out.tracks.length, 1);
  assert.equal(out.tracks[0].name, 'Piano');
  assert.equal(buildTempoMap(out).points.length, buildTempoMap(src).points.length);
  assert.ok(Math.abs(duration(out) - duration(src)) < 1e-9);
});

test('transpose shifts pitched notes, leaves drums, drops out-of-range notes', () => {
  const src = demo('prelude.mid');
  const up = parseSmf(exportSmf(src, { transpose: 5 }).bytes);
  const a = extractNotes(src);
  const b = extractNotes(up);
  const key = (n: (typeof a)[number], shift: number) => `${n.track}:${n.channel}:${n.startTick}:${n.pitch + (n.channel === 9 ? 0 : shift)}`;
  assert.deepEqual(b.map((n) => key(n, 0)).sort(), a.map((n) => key(n, 5)).sort());
  const smf = parseSmf(writeSmf({ tracks: [toDeltas([{ tick: 0, bytes: [0x90, 125, 90] }, { tick: 10, bytes: [0x80, 125, 0] }, { tick: 10, bytes: [0x90, 60, 90] }, { tick: 20, bytes: [0x80, 60, 0] }])] }));
  const r = exportSmf(smf, { transpose: 5 });
  assert.equal(r.droppedNotes, 1);
  assert.deepEqual(extractNotes(parseSmf(r.bytes)).map((n) => n.pitch), [65]);
});

test('tempo scale changes duration, not ticks', () => {
  const src = demo('prelude.mid');
  const fast = parseSmf(exportSmf(src, { tempoScale: 2 }).bytes);
  assert.ok(Math.abs(duration(fast) - duration(src) / 2) < 1e-3);
  assert.deepEqual(fast.tracks.map((t) => t.endTick), src.tracks.map((t) => t.endTick));
  assert.throws(() => exportSmf(demo('drum-loop.mid'), { tempoScale: 2 }), /SMPTE/);
});

test('format 0 merge keeps every event in time order', () => {
  const src = demo('prelude.mid');
  const r = exportSmf(src, { format: 0 });
  const out = parseSmf(r.bytes);
  assert.equal(out.header.format, 0);
  assert.equal(out.tracks.length, 1);
  const ticks = out.tracks[0].events.map((e) => e.tick);
  assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b));
  assert.equal(extractNotes(out).length, extractNotes(src).length);
  // One End of Track instead of four.
  assert.equal(out.tracks[0].events.length, src.tracks.reduce((n, t) => n + t.events.length, 0) - 3);
});

test('strip SysEx, scale velocity, keep SMPTE division', () => {
  const ode = demo('ode-to-joy.mid');
  const out = parseSmf(exportSmf(ode, { stripSysex: true, velocityScale: 0.5 }).bytes);
  assert.equal(out.tracks[0].events.filter((e) => e.kind === 'sysex').length, 0);
  const v1 = extractNotes(ode)[0].velocity;
  assert.equal(extractNotes(out)[0].velocity, Math.round(v1 * 0.5));
  const drums = parseSmf(exportSmf(demo('drum-loop.mid')).bytes);
  assert.deepEqual(drums.header.smpte, { fps: 25, ticksPerFrame: 40 });
});

test('CSV follows midicsv record formats', () => {
  const smf = parseSmf(writeSmf({ ppq: 96, tracks: [toDeltas([
    { tick: 0, bytes: textMeta(0x03, 'Say "hi"\\') },
    { tick: 0, bytes: tempoMeta(120) },
    { tick: 0, bytes: [0xff, 0x59, 2, 0xfd, 1] },
    { tick: 0, bytes: [0xf0, 3, 0x7e, 0x09, 0xf7] },
    { tick: 0, bytes: [0x90, 60, 100] },
    { tick: 48, bytes: [0xe0, 0, 0x40] },
    { tick: 96, bytes: [0x80, 60, 64] },
  ])] }));
  const lines = toCsv(smf).trim().split('\n');
  assert.deepEqual(lines, [
    '0, 0, Header, 1, 1, 96',
    '1, 0, Start_track',
    '1, 0, Title_t, "Say \\"hi\\"\\\\"',
    '1, 0, Tempo, 500000',
    '1, 0, Key_signature, -3, "minor"',
    '1, 0, System_exclusive, 3, 126, 9, 247',
    '1, 0, Note_on_c, 0, 60, 100',
    '1, 48, Pitch_bend_c, 0, 8192',
    '1, 96, Note_off_c, 0, 60, 64',
    '1, 96, End_track',
    '0, 0, End_of_file',
  ]);
});

test('JSON has header, tempos and readable events', () => {
  const j = toJson(demo('ode-to-joy.mid'));
  assert.equal(j.header.format, 0);
  assert.equal(j.header.ticksPerQuarter, 480);
  assert.equal(j.tempos[0].bpm, 100);
  const ev = j.tracks[0].events;
  assert.ok(ev.some((e) => e.type === 'meta' && e.name === 'Lyric' && e.text === 'Freu'));
  assert.ok(ev.some((e) => e.type === 'noteOn' && e.channel === 1 && e.note === 66));
  assert.ok(ev.some((e) => e.type === 'sysex'));
  assert.doesNotThrow(() => JSON.stringify(j));
});
