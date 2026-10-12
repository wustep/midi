import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSmf, writeSmf, toDeltas, buildTempoMap, extractNotes, signatures, barBeat, keyName, describeEvent,
  demoSmf, tempoMeta, textMeta, meta,
} from '../src/lib/smf.ts';

const simple = () =>
  writeSmf({
    ppq: 480,
    tracks: [
      toDeltas([{ tick: 0, bytes: tempoMeta(120) }, { tick: 960, bytes: tempoMeta(60) }, { tick: 0, bytes: meta(0x58, [3, 2, 24, 8]) }]),
      toDeltas([
        { tick: 0, bytes: textMeta(0x03, 'Lead') },
        { tick: 0, bytes: [0x90, 60, 100] },
        { tick: 480, bytes: [0x90, 60, 0] },
        { tick: 480, bytes: [0x90, 64, 90] },
        { tick: 1440, bytes: [0x80, 64, 0] },
      ]),
    ],
  });

test('round-trips header, tracks and events', () => {
  const smf = parseSmf(simple());
  assert.equal(smf.header.format, 1);
  assert.equal(smf.header.ppq, 480);
  assert.equal(smf.tracks.length, 2);
  assert.deepEqual(smf.warnings, []);
  assert.equal(smf.tracks[1].name, 'Lead');
  const ch = smf.tracks[1].events.filter((e) => e.kind === 'channel');
  assert.equal(ch.length, 4);
  assert.equal(smf.tracks[1].endTick, 1440);
});

test('running status is read and the status byte is reported', () => {
  const bytes = writeSmf({ tracks: [[{ delta: 0, bytes: [0x90, 60, 100] }, { delta: 10, bytes: [0x90, 62, 100] }, { delta: 10, bytes: [0x90, 60, 0] }]], runningStatus: true });
  // 2 running-status events save 2 bytes compared with explicit status bytes.
  const explicit = writeSmf({ tracks: [[{ delta: 0, bytes: [0x90, 60, 100] }, { delta: 10, bytes: [0x90, 62, 100] }, { delta: 10, bytes: [0x90, 60, 0] }]] });
  assert.equal(explicit.length - bytes.length, 2);
  const evs = parseSmf(bytes).tracks[0].events.filter((e) => e.kind === 'channel');
  assert.deepEqual(evs.map((e) => e.kind === 'channel' && e.runningStatus), [false, true, true]);
  assert.deepEqual(evs[1].bytes, [0x90, 62, 100]);
});

test('tempo map converts ticks to seconds across tempo changes', () => {
  const smf = parseSmf(simple());
  const tm = buildTempoMap(smf);
  assert.equal(tm.points.length, 2);
  assert.equal(tm.tickToSeconds(480), 0.5);
  assert.equal(tm.tickToSeconds(960), 1);
  assert.equal(tm.tickToSeconds(1440), 2); // 60 BPM after tick 960
  assert.equal(tm.secondsToTick(2), 1440);
  assert.equal(tm.secondsToTick(0.25), 240);
});

test('default tempo is 120 BPM when there are no tempo events', () => {
  const smf = parseSmf(writeSmf({ ppq: 96, tracks: [[{ delta: 96, bytes: [0x90, 60, 1] }]] }));
  assert.equal(buildTempoMap(smf).tickToSeconds(96), 0.5);
});

test('SMPTE division ignores tempo', () => {
  const bytes = writeSmf({ tracks: [[{ delta: 0, bytes: tempoMeta(60) }, { delta: 100, bytes: [0x90, 60, 1] }]] });
  bytes[12] = 0xe7; // -25 fps
  bytes[13] = 40; // 40 ticks per frame -> 1000 ticks/s
  const smf = parseSmf(bytes);
  assert.deepEqual(smf.header.smpte, { fps: 25, ticksPerFrame: 40 });
  assert.equal(buildTempoMap(smf).tickToSeconds(1000), 1);
});

test('notes pair on/off, treat velocity 0 as off, match overlaps FIFO, and close hanging notes', () => {
  const bytes = writeSmf({
    tracks: [
      toDeltas([
        { tick: 0, bytes: [0xc0, 5] },
        { tick: 0, bytes: [0x90, 60, 100] },
        { tick: 100, bytes: [0x90, 60, 80] }, // overlapping same pitch
        { tick: 200, bytes: [0x80, 60, 0] }, // closes the first
        { tick: 300, bytes: [0x90, 60, 0] }, // closes the second
        { tick: 300, bytes: [0x91, 72, 50] }, // never released
        { tick: 500, bytes: [0xff, 0x2f, 0] },
      ]),
    ],
  });
  const notes = extractNotes(parseSmf(bytes));
  assert.equal(notes.length, 3);
  assert.deepEqual(notes.map((n) => [n.pitch, n.startTick, n.endTick, n.velocity]), [[60, 0, 200, 100], [60, 100, 300, 80], [72, 300, 500, 50]]);
  assert.equal(notes[0].program, 5);
  assert.equal(notes[2].channel, 1);
});

test('time and key signatures, bar:beat positions', () => {
  const smf = parseSmf(simple());
  const { time } = signatures(smf);
  assert.deepEqual(time[0], { tick: 0, numerator: 3, denominator: 4, clocksPerClick: 24, thirtySecondsPerQuarter: 8 });
  assert.equal(barBeat(0, 480, time), '1:1:0');
  assert.equal(barBeat(1440, 480, time), '2:1:0');
  assert.equal(barBeat(1500, 480, time), '2:1:60');
  assert.equal(barBeat(960, 480, []), '1:3:0');
  assert.equal(keyName(-3, false), 'E♭ major');
  assert.equal(keyName(1, true), 'E minor');
  assert.equal(keyName(0, false), 'C major');
});

test('describes events', () => {
  const smf = parseSmf(simple());
  const tempo = smf.tracks[0].events.find((e) => e.kind === 'meta' && e.metaType === 0x51)!;
  assert.equal(describeEvent(tempo).detail, '500000 µs/quarter = 120 BPM');
  const off = smf.tracks[1].events.find((e) => e.kind === 'channel' && e.data2 === 0 && e.type === 'noteOn')!;
  assert.equal(describeEvent(off).name, 'Note Off (vel 0)');
});

test('unwraps RIFF RMID files', () => {
  const smf = simple();
  const riff = new Uint8Array(20 + smf.length);
  const dv = new DataView(riff.buffer);
  riff.set([0x52, 0x49, 0x46, 0x46], 0);
  dv.setUint32(4, 12 + smf.length, true);
  riff.set([0x52, 0x4d, 0x49, 0x44, 0x64, 0x61, 0x74, 0x61], 8);
  dv.setUint32(16, smf.length, true);
  riff.set(smf, 20);
  const parsed = parseSmf(riff);
  assert.equal(parsed.rmid, true);
  assert.equal(parsed.tracks.length, 2);
  assert.deepEqual(parsed.warnings, []);
});

test('reports truncation, junk and missing End of Track without throwing', () => {
  const full = simple();
  const cut = parseSmf(full.slice(0, full.length - 6));
  assert.ok(cut.warnings.some((w) => /truncated/.test(w)), cut.warnings.join('\n'));
  assert.ok(cut.warnings.some((w) => /no End of Track/.test(w)));
  const junk = new Uint8Array(full.length + 3);
  junk.set([1, 2, 3]);
  junk.set(full, 3);
  const j = parseSmf(junk);
  assert.equal(j.tracks.length, 2);
  assert.ok(j.warnings[0].startsWith('Skipped 3 bytes'));
});

test('rejects files without an MThd header', () => {
  assert.throws(() => parseSmf(new TextEncoder().encode('hello world, not midi')), /no "MThd"/);
  assert.throws(() => parseSmf(new Uint8Array()), /no "MThd"/);
});

test('demo file parses cleanly', () => {
  const smf = parseSmf(demoSmf());
  assert.deepEqual(smf.warnings, []);
  assert.equal(smf.tracks.length, 4);
  const notes = extractNotes(smf);
  assert.ok(notes.length > 100);
  assert.ok(notes.some((n) => n.channel === 9));
  assert.ok(buildTempoMap(smf).points.length >= 3);
});

test('fuzz: corrupted files never throw once a header is present', () => {
  const base = demoSmf();
  let seed = 1;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  for (let run = 0; run < 500; run++) {
    const b = base.slice(0, 14 + Math.floor(rand() * (base.length - 14)) + 1);
    for (let k = 0; k < 1 + Math.floor(rand() * 20); k++) {
      const at = 14 + Math.floor(rand() * Math.max(1, b.length - 14));
      if (at < b.length) b[at] = Math.floor(rand() * 256);
    }
    const smf = parseSmf(b);
    const notes = extractNotes(smf);
    for (const n of notes) assert.ok(Number.isFinite(n.start) && n.end >= n.start);
  }
});

import { byteRoles, eventAt, annotateEvent, annotateHeader, trackStats, controllerUsage, sysexList, metaSummary, textEvents, Role } from '../src/lib/smf-analysis.ts';

test('event byte spans tile each track exactly and match the stored bytes', () => {
  for (const bytes of [demoSmf(), simple()]) {
    const smf = parseSmf(bytes);
    for (const t of smf.tracks) {
      let at = t.offset + 8;
      for (const e of t.events) {
        assert.equal(e.offset, at);
        const raw = Array.from(bytes.subarray(e.offset + e.deltaLength, e.offset + e.length));
        const expected = e.kind === 'channel' && e.runningStatus ? e.bytes.slice(1) : e.bytes;
        assert.deepEqual(raw, expected);
        at = e.offset + e.length;
      }
      assert.equal(at, t.offset + 8 + t.length);
    }
  }
});

test('byte roles and byte → event lookup', () => {
  const bytes = demoSmf();
  const smf = parseSmf(bytes);
  const idx = byteRoles(smf);
  assert.equal(idx.roles.length, bytes.length);
  assert.deepEqual(Array.from(idx.roles.subarray(0, 14)), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3]);
  assert.ok(idx.roles.every((r) => r !== Role.None));
  const ev = smf.tracks[1].events[5];
  for (let o = ev.offset; o < ev.offset + ev.length; o++) assert.equal(eventAt(idx, o), ev);
  assert.equal(eventAt(idx, 3), undefined);
  // Running-status events have no status byte role.
  const rs = smf.tracks[1].events.find((e) => e.kind === 'channel' && e.runningStatus)!;
  assert.equal(idx.roles[rs.offset + rs.deltaLength], Role.Data);
});

test('annotations cover every byte of an event', () => {
  const bytes = demoSmf();
  const smf = parseSmf(bytes);
  for (const e of smf.tracks.flatMap((t) => t.events)) {
    const a = annotateEvent(e, bytes);
    const covered = a.filter((x) => x.end > x.start).reduce((n, x) => n + x.end - x.start, 0);
    assert.equal(covered, e.length, JSON.stringify(a));
  }
  const h = annotateHeader(smf);
  assert.equal(h.at(-1)!.end, 14);
  assert.match(h.at(-1)!.detail, /480 ticks per quarter/);
});

test('summaries: tracks, controllers, sysex, meta', () => {
  const sx = writeSmf({
    format: 0,
    tracks: [
      toDeltas([
        { tick: 0, bytes: [0xf0, 5, 0x7e, 0x7f, 0x09, 0x01, 0xf7] },
        { tick: 0, bytes: [0xf0, 10, 0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7f, 0x00, 0x41, 0xf7] },
        { tick: 0, bytes: textMeta(0x05, 'la') },
        { tick: 0, bytes: [0xc0, 40] },
        { tick: 0, bytes: [0xb0, 1, 10] },
        { tick: 10, bytes: [0xb0, 1, 90] },
        { tick: 10, bytes: [0xe0, 0, 0x60] },
        { tick: 10, bytes: [0x90, 70, 90] },
        { tick: 20, bytes: [0x80, 70, 0] },
      ]),
    ],
  });
  const smf = parseSmf(sx);
  const notes = extractNotes(smf);
  const ts = trackStats(smf, notes);
  assert.equal(ts[0].notes, 1);
  assert.equal(ts[0].lowest, 70);
  assert.deepEqual(ts[0].programs.map((p) => p.name), ['41 · Violin']);
  const cc = controllerUsage(smf);
  assert.deepEqual(cc.map((c) => [c.label, c.count, c.min, c.max]), [['CC 1 · Modulation Wheel', 2, 10, 90], ['Pitch bend', 1, 4096, 4096]]);
  const sys = sysexList(smf);
  assert.deepEqual(sys.map((s) => [s.manufacturer, s.description, s.complete]), [['Universal Non-Real Time', 'General MIDI System On', true], ['Roland', 'Roland GS Reset (DT1)', true]]);
  assert.deepEqual(metaSummary(smf).map((m) => m.name), ['Lyric', 'End of Track']);
  assert.equal(textEvents(smf)[0].text, 'la');
});
