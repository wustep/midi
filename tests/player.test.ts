import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseSmf, writeSmf, toDeltas, tempoMeta } from '../src/lib/smf.ts';
import { timeline, Player, type Sink } from '../src/lib/synth.ts';

const file = () =>
  parseSmf(
    writeSmf({
      ppq: 480,
      tracks: [
        toDeltas([{ tick: 0, bytes: tempoMeta(120) }]),
        toDeltas([
          { tick: 0, bytes: [0xc0, 10] },
          { tick: 0, bytes: [0x90, 60, 100] },
          { tick: 480, bytes: [0x90, 60, 100] }, // retrigger at the same tick as the note off below
          { tick: 480, bytes: [0x80, 60, 0] },
          { tick: 960, bytes: [0x80, 60, 0] },
        ]),
        toDeltas([{ tick: 240, bytes: [0x91, 40, 80] }, { tick: 720, bytes: [0x81, 40, 0] }]),
      ],
    }),
  );

test('timeline merges tracks in time order and puts note-offs before note-ons at the same time', () => {
  const tl = timeline(file());
  assert.deepEqual(tl.map((e) => e.time), [0, 0, 0.25, 0.5, 0.5, 0.75, 1]);
  assert.deepEqual(tl[3].bytes, [0x80, 60, 0]);
  assert.deepEqual(tl[4].bytes, [0x90, 60, 100]);
  assert.equal(tl[0].isNote, false);
});

function rig() {
  const ctx = { currentTime: 0 } as unknown as AudioContext;
  const sent: { bytes: number[]; at: number }[] = [];
  let panics = 0;
  const sink: Sink = { send: (bytes, at) => sent.push({ bytes, at }), panic: () => panics++ };
  const p = new Player(ctx, sink);
  p.load(timeline(file()), 1);
  return { ctx: ctx as { currentTime: number }, sent, p, panics: () => panics };
}

test('player schedules events ahead with the right audio times', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { ctx, sent, p } = rig();
    p.play();
    // Look-ahead is 0.2 s; only events up to then are sent immediately.
    assert.deepEqual(sent.map((s) => s.bytes[0]), [0xc0, 0x90]);
    ctx.currentTime = 0.2;
    mock.timers.tick(25);
    assert.deepEqual(sent.map((s) => s.bytes[0]), [0xc0, 0x90, 0x91]);
    assert.ok(Math.abs(sent[2].at - 0.3) < 1e-9); // 0.25 s + 0.05 s start offset
    ctx.currentTime = 0.36; // horizon 0.56 reaches the events at 0.5 s (audio time 0.55)
    mock.timers.tick(25);
    assert.deepEqual(sent.map((s) => s.bytes[0]), [0xc0, 0x90, 0x91, 0x80, 0x90]);
    ctx.currentTime = 1.2;
    mock.timers.tick(25);
    assert.equal(sent.length, 7);
    assert.equal(p.playing, false);
  } finally {
    mock.timers.reset();
  }
});

test('seeking chases program changes and skips earlier notes; muted tracks drop note-ons', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { ctx, sent, p, panics } = rig();
    p.muted.add(2);
    p.seek(0.6);
    p.play();
    assert.deepEqual(sent[0].bytes, [0xc0, 10]); // chased
    ctx.currentTime = 2;
    mock.timers.tick(25);
    const notes = sent.slice(1).map((s) => s.bytes);
    assert.deepEqual(notes, [[0x81, 40, 0], [0x80, 60, 0]]);
    p.play();
    p.pause();
    assert.ok(panics() >= 1);
  } finally {
    mock.timers.reset();
  }
});

test('rate change keeps the position', () => {
  const { ctx, p } = rig();
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    p.play();
    ctx.currentTime = 0.45; // 0.4 s in
    p.setRate(2);
    assert.ok(Math.abs(p.position - 0.4) < 1e-9);
    ctx.currentTime = 0.45 + 0.05 + 0.1;
    assert.ok(Math.abs(p.position - 0.6) < 1e-9, String(p.position));
  } finally {
    p.stop();
    mock.timers.reset();
  }
});
