/**
 * Statistics for the MIDI clock and latency tester: interval jitter of incoming Timing Clock (F8)
 * messages, tempo estimation, histograms, and round-trip loopback probes.
 */

export interface Stats {
  count: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

/** Percentile with linear interpolation on a sorted array (p in 0–100). */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = ((sorted.length - 1) * p) / 100;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function summarize(values: number[]): Stats {
  const n = values.length;
  if (!n) return { count: 0, mean: NaN, sd: NaN, min: NaN, max: NaN, p50: NaN, p95: NaN, p99: NaN };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const sorted = [...values].sort((a, b) => a - b);
  return { count: n, mean, sd, min: sorted[0], max: sorted[n - 1], p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}

export const intervals = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

/** Tempo from the mean interval between clocks (24 per quarter note). */
export const bpmFromInterval = (ms: number) => 60000 / (ms * 24);
export const intervalFromBpm = (bpm: number) => 60000 / (bpm * 24);

export interface ClockAnalysis {
  /** Intervals between consecutive clocks, ms. */
  intervals: Stats;
  /** Each interval's deviation from the mean interval, ms. */
  jitter: Stats;
  bpm: number;
  /** Tempo from the first to the last clock, which ignores jitter entirely. */
  bpmOverall: number;
  /** Longest gap, as a count of missing clocks (gap / mean − 1, rounded). */
  dropouts: number;
}

/**
 * Analyse clock timestamps (ms). Gaps longer than `maxGap` intervals (e.g. the clock was stopped and
 * restarted) split the stream, and only intervals inside runs count.
 */
export function analyseClock(times: number[], maxGap = 4): ClockAnalysis | null {
  if (times.length < 3) return null;
  const all = intervals(times);
  const median = percentile([...all].sort((a, b) => a - b), 50);
  const kept = all.filter((d) => d > 0 && d <= median * maxGap);
  if (kept.length < 2) return null;
  const iv = summarize(kept);
  const jitter = summarize(kept.map((d) => d - iv.mean));
  let span = 0;
  let count = 0;
  for (const d of all) if (d <= median * maxGap) (span += d), count++;
  const dropouts = Math.max(0, ...kept.map((d) => Math.round(d / iv.mean) - 1));
  return { intervals: iv, jitter, bpm: bpmFromInterval(iv.mean), bpmOverall: count ? bpmFromInterval(span / count) : NaN, dropouts };
}

/** Histogram of values into `bins` equal-width buckets between lo and hi (values outside are clamped). */
export function histogram(values: number[], lo: number, hi: number, bins: number): number[] {
  const out = new Array(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)));
    out[i]++;
  }
  return out;
}

/* ---------------- Loopback latency probes ---------------- */

export type ProbeKind = 'note' | 'cc' | 'sysex';

/**
 * The message for probe number `id` (0–127). Notes and CCs go on channel 16 so they're easy to filter;
 * SysEx uses the non-commercial ID 7D and needs SysEx permission.
 */
export function probeMessage(kind: ProbeKind, id: number): number[] {
  const v = id & 0x7f;
  switch (kind) {
    case 'note': return [0x9f, v, 1 + (v % 126)];
    case 'cc': return [0xbf, 119, v];
    case 'sysex': return [0xf0, 0x7d, 0x4d, 0x4c, v, 0xf7]; // 7D "M" "L" id
  }
}

/** If `data` is a probe of this kind, its id; otherwise null. */
export function matchProbe(kind: ProbeKind, data: ArrayLike<number>): number | null {
  const d = Array.from(data);
  switch (kind) {
    case 'note': return d.length === 3 && d[0] === 0x9f && d[2] > 0 && d[2] === 1 + (d[1] % 126) ? d[1] : null;
    case 'cc': return d.length === 3 && d[0] === 0xbf && d[1] === 119 ? d[2] : null;
    case 'sysex': return d.length === 6 && d[0] === 0xf0 && d[1] === 0x7d && d[2] === 0x4d && d[3] === 0x4c && d[5] === 0xf7 ? d[4] : null;
  }
}

/** Tracks sent probes and pairs them with arrivals to compute round-trip times. */
export class ProbeTracker {
  private pending = new Map<number, number>();
  readonly rtts: number[] = [];
  lost = 0;
  private next = 0;

  /** Returns the id to send and records its send time. Ids still pending after 128 probes count as lost. */
  send(at: number): number {
    const id = this.next;
    this.next = (this.next + 1) % 128;
    if (this.pending.has(id)) this.lost++;
    this.pending.set(id, at);
    return id;
  }

  receive(id: number, at: number): number | null {
    const sent = this.pending.get(id);
    if (sent === undefined) return null;
    this.pending.delete(id);
    const rtt = at - sent;
    this.rtts.push(rtt);
    return rtt;
  }

  /** Count probes older than `timeout` ms as lost. */
  expire(now: number, timeout: number) {
    for (const [id, t] of this.pending) {
      if (now - t > timeout) {
        this.pending.delete(id);
        this.lost++;
      }
    }
  }

  get outstanding() {
    return this.pending.size;
  }
}

/** Deterministic pseudo-random generator for simulations and tests. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Simulated clock timestamps at `bpm` with Gaussian jitter (sd in ms), for the demo mode. */
export function simulateClock(bpm: number, count: number, jitterSd: number, seed = 7, start = 0): number[] {
  const r = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const step = intervalFromBpm(bpm);
  return Array.from({ length: count }, (_, i) => start + i * step + gauss() * jitterSd);
}
