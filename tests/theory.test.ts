import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePitch, spell, transpose, midiOf, build, SCALES, CHORDS, diatonicChords, identifyChord, pitchClass } from '../src/lib/theory.ts';

const P = (s: string) => parsePitch(s)!;
const scale = (root: string, id: string) => build(P(root), 4, SCALES.find((x) => x.id === id)!.intervals).map((n) => n.name);
const chord = (root: string, id: string, inv = 0, oct = 4) => build(P(root), oct, CHORDS.find((c) => c.id === id)!.intervals, inv);

test('parses note names with accidentals and octaves', () => {
  assert.deepEqual(P('C#4'), { letter: 0, accidental: 1, octave: 4 });
  assert.deepEqual(P('bb'), { letter: 6, accidental: -1 });
  assert.deepEqual(P('E♭-1'), { letter: 2, accidental: -1, octave: -1 });
  assert.equal(parsePitch('H'), null);
  assert.equal(midiOf(P('C'), 4), 60);
  assert.equal(midiOf(P('A'), 4), 69);
  assert.equal(midiOf(P('B#'), 3), 60);
  assert.equal(midiOf(P('Cb'), 4), 59);
});

test('spells major scales correctly in every key', () => {
  assert.deepEqual(scale('C', 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.deepEqual(scale('F', 'major'), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
  assert.deepEqual(scale('F#', 'major'), ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
  assert.deepEqual(scale('Db', 'major'), ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C']);
  // Every heptatonic scale uses each letter exactly once.
  for (const s of SCALES.filter((x) => x.heptatonic)) {
    for (const r of ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'F#']) {
      const notes = build(P(r), 4, s.intervals);
      assert.equal(new Set(notes.map((n) => n.pitch.letter)).size, 7, `${r} ${s.id}`);
      notes.forEach((n, i) => assert.equal(pitchClass(n.pitch), (n.midi % 12 + 12) % 12, `${r} ${s.id} ${i}`));
    }
  }
});

test('spells minor and modal scales', () => {
  assert.deepEqual(scale('A', 'harmonic-minor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G♯']);
  assert.deepEqual(scale('D', 'dorian'), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  assert.deepEqual(scale('G#', 'harmonic-minor'), ['G♯', 'A♯', 'B', 'C♯', 'D♯', 'E', 'F𝄪']);
  assert.deepEqual(scale('A', 'minor-pentatonic'), ['A', 'C', 'D', 'E', 'G']);
  assert.deepEqual(scale('C', 'blues'), ['C', 'E♭', 'F', 'G♭', 'G', 'B♭']);
});

test('builds chords with names, MIDI numbers and inversions', () => {
  assert.deepEqual(chord('C', 'maj').map((n) => [n.name, n.midi]), [['C', 60], ['E', 64], ['G', 67]]);
  assert.deepEqual(chord('Eb', 'm7').map((n) => n.name), ['E♭', 'G♭', 'B♭', 'D♭']);
  assert.deepEqual(chord('B', 'dim7').map((n) => n.name), ['B', 'D', 'F', 'A♭']);
  assert.deepEqual(chord('C', 'maj', 1).map((n) => n.midi), [64, 67, 72]);
  assert.deepEqual(chord('C', 'maj', 2).map((n) => n.midi), [67, 72, 76]);
  assert.deepEqual(chord('C', '7', 3).map((n) => n.midi), [70, 72, 76, 79]);
  assert.deepEqual(chord('C', '9').map((n) => n.intervalName), ['R', '3', '5', '♭7', '9']);
  assert.deepEqual(transpose(P('E'), [3, 4]), { letter: 4, accidental: 1 }); // G♯
});

test('diatonic triads and sevenths', () => {
  const C = SCALES.find((s) => s.id === 'major')!;
  assert.deepEqual(diatonicChords(P('C'), C).map((d) => `${d.roman} ${d.symbol}`), ['I C', 'ii Dm', 'iii Em', 'IV F', 'V G', 'vi Am', 'vii° B°']);
  assert.deepEqual(diatonicChords(P('C'), C, true).map((d) => d.symbol), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  const hm = SCALES.find((s) => s.id === 'harmonic-minor')!;
  assert.deepEqual(diatonicChords(P('A'), hm).map((d) => d.roman), ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']);
  assert.deepEqual(diatonicChords(P('A'), SCALES.find((s) => s.id === 'blues')!), []);
});

test('identifies chords from MIDI notes, including inversions and omitted fifths', () => {
  assert.equal(identifyChord([60, 64, 67])[0].name, 'C');
  assert.equal(identifyChord([64, 67, 72])[0].name, 'C/E');
  assert.equal(identifyChord([57, 60, 64, 67])[0].name, 'Am7');
  assert.equal(identifyChord([55, 59, 62, 65])[0].name, 'G7');
  assert.equal(identifyChord([60, 64, 70])[0].name, 'C7 (no 5)');
  assert.equal(identifyChord([62, 65, 69, 72, 76])[0].name, 'Dm9');
  assert.deepEqual(identifyChord([60]), []);
  assert.deepEqual(identifyChord([60, 61, 62]), []);
  // C6 and Am7 share notes; the bass decides.
  assert.equal(identifyChord([60, 64, 67, 69])[0].name, 'C6');
  assert.equal(identifyChord([45, 60, 64, 67])[0].name, 'Am7');
});

test('spell handles double accidentals', () => {
  assert.equal(spell({ letter: 3, accidental: 2 }), 'F𝄪');
  assert.equal(spell({ letter: 6, accidental: -2 }), 'B𝄫');
});
