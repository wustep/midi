#!/usr/bin/env node
/**
 * Writes the demo files bundled with the MIDI Reader to public/demos/. They are generated here (not
 * downloaded) so their content is known exactly: public-domain music, arranged for this site, CC0.
 *
 *   prelude.mid      format 1 · 4 tracks · 480 PPQ · running status · tempo changes (Bach, BWV 846)
 *   ode-to-joy.mid   format 0 · SysEx (GM On, GS Reset) · lyrics (UTF-8) · key signature · CCs · pitch bend (Beethoven)
 *   drum-loop.mid    format 0 · SMPTE timing (25 fps × 40) · XG System On · SMPTE offset · running status
 *
 * Usage: node scripts/make-demos.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { demoSmf, writeSmf, toDeltas, meta, textMeta, tempoMeta } from '../src/lib/smf.ts';

const out = new URL('../public/demos/', import.meta.url);
await mkdir(out, { recursive: true });

function odeToJoy() {
  const q = 480;
  // [note, beats, syllable]
  const D = 62, E = 64, Fs = 66, G = 67, A = 69;
  const phrase1 = [[Fs, 1, 'Freu'], [Fs, 1, 'de, '], [G, 1, 'schö'], [A, 1, 'ner '], [A, 1, 'Göt'], [G, 1, 'ter'], [Fs, 1, 'fun'], [E, 1, 'ken, ']];
  const phrase2 = [[D, 1, 'Toch'], [D, 1, 'ter '], [E, 1, 'aus '], [Fs, 1, 'E'], [Fs, 1.5, 'ly'], [E, 0.5, 'si'], [E, 2, 'um, ']];
  const phrase3 = [[Fs, 1, 'wir '], [Fs, 1, 'be'], [G, 1, 'tre'], [A, 1, 'ten '], [A, 1, 'feu'], [G, 1, 'er'], [Fs, 1, 'trun'], [E, 1, 'ken, ']];
  const phrase4 = [[D, 1, 'Himm'], [D, 1, 'li'], [E, 1, 'sche, '], [Fs, 1, 'dein '], [E, 1.5, 'Hei'], [D, 0.5, 'lig'], [D, 2, 'tum!']];
  const ev = [
    { tick: 0, bytes: textMeta(0x03, 'Ode to Joy') },
    { tick: 0, bytes: textMeta(0x02, 'Public domain melody (L. van Beethoven, Symphony No. 9); text by F. Schiller') },
    { tick: 0, bytes: [0xf0, 5, 0x7e, 0x7f, 0x09, 0x01, 0xf7] }, // GM System On
    { tick: 0, bytes: [0xf0, 10, 0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7f, 0x00, 0x41, 0xf7] }, // GS Reset
    { tick: 0, bytes: meta(0x58, [4, 2, 24, 8]) },
    { tick: 0, bytes: meta(0x59, [2, 0]) }, // D major
    { tick: 0, bytes: tempoMeta(100) },
    { tick: 0, bytes: [0xc0, 73] }, // Flute
    { tick: 0, bytes: [0xb0, 10, 44] },
    { tick: 0, bytes: [0xb0, 91, 50] },
    { tick: 0, bytes: [0xc1, 48] }, // Strings
    { tick: 0, bytes: [0xb1, 7, 80] },
    { tick: 0, bytes: [0xb1, 10, 84] },
    { tick: 0, bytes: [0xb1, 64, 127] },
    { tick: 0, bytes: [0xc9, 0] }, // drums: standard kit
  ];
  let t = 0;
  const melody = [...phrase1, ...phrase2, ...phrase3, ...phrase4];
  melody.forEach(([n, beats, syl], i) => {
    const len = beats * q;
    ev.push({ tick: t, bytes: textMeta(0x05, syl) });
    ev.push({ tick: t, bytes: [0x90, n, 88 + (i % 4 === 0 ? 10 : 0)] });
    // Mod wheel vibrato and a little pitch scoop on the long notes.
    if (beats >= 1.5) {
      ev.push({ tick: t, bytes: [0xe0, 0x00, 0x38] });
      ev.push({ tick: t + q / 8, bytes: [0xe0, 0x00, 0x40] });
      ev.push({ tick: t + q / 2, bytes: [0xb0, 1, 64] });
      ev.push({ tick: t + len - 20, bytes: [0xb0, 1, 0] });
    }
    ev.push({ tick: t + len - 30, bytes: [0x80, n, 64] });
    t += len;
  });
  // Strings: one sustained chord root per bar, with the pedal re-pressed each bar.
  const roots = [50, 45, 50, 45, 50, 45, 50, 45].map((r, i) => (i === 3 || i === 7 ? (i === 7 ? 50 : 45) : r));
  roots.forEach((r, bar) => {
    const at = bar * 4 * q;
    if (bar) ev.push({ tick: at, bytes: [0xb1, 64, 0] }, { tick: at + 10, bytes: [0xb1, 64, 127] });
    ev.push({ tick: at, bytes: [0x91, r, 70] }, { tick: at, bytes: [0x91, r + 7, 60] }, { tick: at + 4 * q - 40, bytes: [0x81, r, 0] }, { tick: at + 4 * q - 40, bytes: [0x81, r + 7, 0] });
    ev.push({ tick: at, bytes: [0x99, 36, 60] }, { tick: at + 120, bytes: [0x89, 36, 0] }, { tick: at + 2 * q, bytes: [0x99, 42, 40] }, { tick: at + 2 * q + 120, bytes: [0x89, 42, 0] });
  });
  ev.push({ tick: t, bytes: [0xb1, 64, 0] }, { tick: t + q, bytes: [0xff, 0x2f, 0] });
  return writeSmf({ format: 0, ppq: q, tracks: [toDeltas(ev)] });
}

function drumLoop() {
  // SMPTE division: 25 frames per second × 40 ticks per frame = 1000 ticks per second.
  const ev = [
    { tick: 0, bytes: textMeta(0x03, 'Drum loop (SMPTE timing)') },
    { tick: 0, bytes: textMeta(0x02, 'CC0, midi.community') },
    { tick: 0, bytes: meta(0x54, [0x20 | 0, 0, 0, 0, 0]) }, // SMPTE offset 00:00:00:00, 25 fps
    { tick: 0, bytes: [0xf0, 8, 0x43, 0x10, 0x4c, 0x00, 0x00, 0x7e, 0x00, 0xf7] }, // XG System On
    { tick: 0, bytes: [0xb9, 7, 110] },
  ];
  const eighth = 250; // 120 BPM
  for (let bar = 0; bar < 4; bar++) {
    for (let k = 0; k < 8; k++) {
      const t = (bar * 8 + k) * eighth;
      const hit = (n, v) => ev.push({ tick: t, bytes: [0x99, n, v] }, { tick: t + 100, bytes: [0x99, n, 0] });
      hit(bar === 3 && k === 7 ? 46 : 42, k % 2 ? 50 : 80);
      if (k === 0 || k === 5 || (bar % 2 && k === 3)) hit(36, 110);
      if (k === 2 || k === 6) hit(38, 100);
      if (bar === 0 && k === 0) hit(49, 90);
    }
  }
  ev.push({ tick: 32 * eighth, bytes: [0x99, 49, 100] }, { tick: 32 * eighth + 100, bytes: [0x99, 49, 0] }, { tick: 32 * eighth + 1000, bytes: [0xff, 0x2f, 0] });
  const bytes = writeSmf({ format: 0, ppq: 96, tracks: [toDeltas(ev)], runningStatus: true });
  bytes[12] = 0x100 - 25; // -25 fps
  bytes[13] = 40;
  return bytes;
}

const files = { 'prelude.mid': demoSmf(), 'ode-to-joy.mid': odeToJoy(), 'drum-loop.mid': drumLoop() };
for (const [name, bytes] of Object.entries(files)) {
  await writeFile(new URL(name, out), bytes);
  console.log(`public/demos/${name} (${bytes.length} bytes)`);
}
