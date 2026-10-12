import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, percentile, analyseClock, bpmFromInterval, intervalFromBpm, histogram, probeMessage, matchProbe, ProbeTracker, simulateClock } from '../src/lib/timing-stats.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('summary statistics', () => {
  const s = summarize([1, 2, 3, 4]);
  assert.equal(s.mean, 2.5);
  close(s.sd, Math.sqrt(1.25));
  assert.equal(s.min, 1);
  assert.equal(s.max, 4);
  assert.equal(s.p50, 2.5);
  close(percentile([0, 10], 95), 9.5);
  assert.ok(Number.isNaN(summarize([]).mean));
});

test('tempo and clock intervals', () => {
  close(intervalFromBpm(120), 60000 / 2880);
  close(bpmFromInterval(intervalFromBpm(97.5)), 97.5);
});

test('a perfect clock has zero jitter', () => {
  const t = Array.from({ length: 97 }, (_, i) => i * intervalFromBpm(120));
  const a = analyseClock(t)!;
  close(a.bpm, 120, 1e-6);
  close(a.jitter.sd, 0, 1e-9);
  assert.equal(a.dropouts, 0);
});

test('jittery clock: tempo still right, jitter measured', () => {
  const t = simulateClock(128, 2000, 0.5);
  const a = analyseClock(t)!;
  close(a.bpm, 128, 0.5);
  close(a.bpmOverall, 128, 0.05);
  // Interval jitter of two independent N(0, 0.5) timestamps has sd ≈ 0.5·√2.
  close(a.jitter.sd, 0.5 * Math.SQRT2, 0.06);
});

test('stops and restarts are not counted as intervals; dropped clocks are', () => {
  const step = intervalFromBpm(120);
  const run1 = Array.from({ length: 20 }, (_, i) => i * step);
  const run2 = Array.from({ length: 20 }, (_, i) => 5000 + i * step);
  const a = analyseClock([...run1, ...run2])!;
  close(a.bpm, 120, 1e-6);
  assert.equal(a.intervals.count, 38);
  const gap = [...run1.slice(0, 10), ...run1.slice(12)];
  assert.equal(analyseClock(gap)!.dropouts, 2);
  assert.equal(analyseClock([0, 1]), null);
});

test('histogram buckets and clamps', () => {
  assert.deepEqual(histogram([-5, -0.5, 0, 0.2, 0.9, 5], -1, 1, 4), [1, 1, 2, 2]);
});

test('probe messages round-trip through the matcher for every id', () => {
  for (const kind of ['note', 'cc', 'sysex'] as const) {
    for (let id = 0; id < 128; id++) assert.equal(matchProbe(kind, probeMessage(kind, id)), id, `${kind} ${id}`);
  }
  assert.equal(matchProbe('note', [0x90, 60, 100]), null);
  assert.equal(matchProbe('note', [0x9f, 60, 0]), null);
  assert.equal(matchProbe('cc', [0xbf, 7, 3]), null);
  assert.ok(probeMessage('note', 127)[2] <= 127);
});

test('probe tracker pairs arrivals and counts losses', () => {
  const t = new ProbeTracker();
  const a = t.send(100);
  const b = t.send(200);
  assert.equal(t.receive(b, 203.5), 3.5);
  assert.equal(t.receive(b, 210), null); // duplicate
  t.expire(1500, 1000);
  assert.equal(t.lost, 1);
  assert.equal(t.receive(a, 1600), null);
  assert.deepEqual(t.rtts, [3.5]);
  assert.equal(t.outstanding, 0);
});
