/**
 * Chords and scales with correct spelling: every interval is a (degree, semitones) pair, so
 * F major is spelled F G A B♭ C D E, not with A♯. Also chord recognition from MIDI note numbers.
 */

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export interface Pitch {
  /** 0–6 for C–B */
  letter: number;
  /** −2 … +2 (double flat … double sharp) */
  accidental: number;
}

export const pitchClass = (p: Pitch) => (((LETTER_PC[p.letter] + p.accidental) % 12) + 12) % 12;

const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' } as Record<string, string>;
export const spell = (p: Pitch) => `${LETTERS[p.letter]}${ACC[String(p.accidental)] ?? (p.accidental > 0 ? '♯'.repeat(p.accidental) : '♭'.repeat(-p.accidental))}`;

/** Parse "C", "f#", "Bb", "E♭", "C##", optionally followed by an octave ("C#4", "Bb-1"). */
export function parsePitch(input: string): (Pitch & { octave?: number }) | null {
  const m = input.trim().match(/^([A-Ga-g])(#{1,2}|♯|𝄪|x|b{1,2}|♭|𝄫)?(-?\d+)?$/);
  if (!m) return null;
  const letter = 'CDEFGAB'.indexOf(m[1].toUpperCase());
  const a = m[2] ?? '';
  const accidental = a === '#' || a === '♯' ? 1 : a === '##' || a === '𝄪' || a === 'x' ? 2 : a === 'b' || a === '♭' ? -1 : a === 'bb' || a === '𝄫' ? -2 : 0;
  return { letter, accidental, ...(m[3] !== undefined ? { octave: Number(m[3]) } : {}) };
}

/** MIDI note number for a pitch in an octave (scientific pitch: C4 = 60). B♯3 is 60, C♭4 is 59. */
export const midiOf = (p: Pitch, octave: number) => 12 * (octave + 1) + LETTER_PC[p.letter] + p.accidental;

/** An interval: scale degree (1 = unison, 3 = third, 9 = ninth…) and size in semitones. */
export type Interval = [degree: number, semitones: number];

/** Transpose a pitch up by an interval, keeping correct letter names. */
export function transpose(root: Pitch, [degree, semis]: Interval): Pitch {
  const letter = (root.letter + degree - 1) % 7;
  const natural = (LETTER_PC[letter] - LETTER_PC[root.letter] + 12) % 12;
  let acc = ((semis % 12) - natural + root.accidental) % 12;
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, accidental: acc };
}

const INTERVAL_NAMES: Record<string, string> = {
  '1:0': 'R', '2:1': '♭2', '2:2': '2', '2:3': '♯2', '3:3': '♭3', '3:4': '3', '4:5': '4', '4:6': '♯4', '5:6': '♭5', '5:7': '5', '5:8': '♯5',
  '6:8': '♭6', '6:9': '6', '7:9': '𝄫7', '7:10': '♭7', '7:11': '7', '8:12': '8', '9:13': '♭9', '9:14': '9', '9:15': '♯9', '11:17': '11', '11:18': '♯11', '13:20': '♭13', '13:21': '13',
};
export const intervalName = ([d, s]: Interval) => INTERVAL_NAMES[`${d}:${s}`] ?? `${d}(${s})`;

export interface ScaleType {
  id: string;
  name: string;
  intervals: Interval[];
  /** Pentatonic/blues/symmetric scales have no diatonic chords. */
  heptatonic: boolean;
}

const deg = (semis: number[], degrees?: number[]): Interval[] => semis.map((s, i) => [degrees ? degrees[i] : i + 1, s]);

export const SCALES: ScaleType[] = [
  { id: 'major', name: 'Major (Ionian)', intervals: deg([0, 2, 4, 5, 7, 9, 11]), heptatonic: true },
  { id: 'minor', name: 'Natural minor (Aeolian)', intervals: deg([0, 2, 3, 5, 7, 8, 10]), heptatonic: true },
  { id: 'harmonic-minor', name: 'Harmonic minor', intervals: deg([0, 2, 3, 5, 7, 8, 11]), heptatonic: true },
  { id: 'melodic-minor', name: 'Melodic minor (ascending)', intervals: deg([0, 2, 3, 5, 7, 9, 11]), heptatonic: true },
  { id: 'dorian', name: 'Dorian', intervals: deg([0, 2, 3, 5, 7, 9, 10]), heptatonic: true },
  { id: 'phrygian', name: 'Phrygian', intervals: deg([0, 1, 3, 5, 7, 8, 10]), heptatonic: true },
  { id: 'lydian', name: 'Lydian', intervals: deg([0, 2, 4, 6, 7, 9, 11]), heptatonic: true },
  { id: 'mixolydian', name: 'Mixolydian', intervals: deg([0, 2, 4, 5, 7, 9, 10]), heptatonic: true },
  { id: 'locrian', name: 'Locrian', intervals: deg([0, 1, 3, 5, 6, 8, 10]), heptatonic: true },
  { id: 'major-pentatonic', name: 'Major pentatonic', intervals: deg([0, 2, 4, 7, 9], [1, 2, 3, 5, 6]), heptatonic: false },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', intervals: deg([0, 3, 5, 7, 10], [1, 3, 4, 5, 7]), heptatonic: false },
  { id: 'blues', name: 'Blues (minor)', intervals: deg([0, 3, 5, 6, 7, 10], [1, 3, 4, 5, 5, 7]), heptatonic: false },
  { id: 'whole-tone', name: 'Whole tone', intervals: deg([0, 2, 4, 6, 8, 10], [1, 2, 3, 4, 5, 7]), heptatonic: false },
  { id: 'diminished-hw', name: 'Diminished (half–whole)', intervals: deg([0, 1, 3, 4, 6, 7, 9, 10], [1, 2, 3, 3, 4, 5, 6, 7]), heptatonic: false },
  { id: 'chromatic', name: 'Chromatic', intervals: deg([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7]), heptatonic: false },
];

export interface ChordType {
  id: string;
  /** Symbol suffix, e.g. "m7" (empty for a major triad). */
  symbol: string;
  name: string;
  intervals: Interval[];
}

export const CHORDS: ChordType[] = [
  { id: 'maj', symbol: '', name: 'Major triad', intervals: [[1, 0], [3, 4], [5, 7]] },
  { id: 'min', symbol: 'm', name: 'Minor triad', intervals: [[1, 0], [3, 3], [5, 7]] },
  { id: 'dim', symbol: '°', name: 'Diminished triad', intervals: [[1, 0], [3, 3], [5, 6]] },
  { id: 'aug', symbol: '+', name: 'Augmented triad', intervals: [[1, 0], [3, 4], [5, 8]] },
  { id: 'sus2', symbol: 'sus2', name: 'Suspended 2nd', intervals: [[1, 0], [2, 2], [5, 7]] },
  { id: 'sus4', symbol: 'sus4', name: 'Suspended 4th', intervals: [[1, 0], [4, 5], [5, 7]] },
  { id: '5', symbol: '5', name: 'Power chord', intervals: [[1, 0], [5, 7]] },
  { id: '6', symbol: '6', name: 'Major 6th', intervals: [[1, 0], [3, 4], [5, 7], [6, 9]] },
  { id: 'm6', symbol: 'm6', name: 'Minor 6th', intervals: [[1, 0], [3, 3], [5, 7], [6, 9]] },
  { id: '7', symbol: '7', name: 'Dominant 7th', intervals: [[1, 0], [3, 4], [5, 7], [7, 10]] },
  { id: 'maj7', symbol: 'maj7', name: 'Major 7th', intervals: [[1, 0], [3, 4], [5, 7], [7, 11]] },
  { id: 'm7', symbol: 'm7', name: 'Minor 7th', intervals: [[1, 0], [3, 3], [5, 7], [7, 10]] },
  { id: 'mMaj7', symbol: 'm(maj7)', name: 'Minor-major 7th', intervals: [[1, 0], [3, 3], [5, 7], [7, 11]] },
  { id: 'm7b5', symbol: 'm7♭5', name: 'Half-diminished 7th', intervals: [[1, 0], [3, 3], [5, 6], [7, 10]] },
  { id: 'dim7', symbol: '°7', name: 'Diminished 7th', intervals: [[1, 0], [3, 3], [5, 6], [7, 9]] },
  { id: '7sus4', symbol: '7sus4', name: 'Dominant 7th sus4', intervals: [[1, 0], [4, 5], [5, 7], [7, 10]] },
  { id: 'aug7', symbol: '+7', name: 'Augmented 7th', intervals: [[1, 0], [3, 4], [5, 8], [7, 10]] },
  { id: 'add9', symbol: 'add9', name: 'Added 9th', intervals: [[1, 0], [3, 4], [5, 7], [9, 14]] },
  { id: '9', symbol: '9', name: 'Dominant 9th', intervals: [[1, 0], [3, 4], [5, 7], [7, 10], [9, 14]] },
  { id: 'maj9', symbol: 'maj9', name: 'Major 9th', intervals: [[1, 0], [3, 4], [5, 7], [7, 11], [9, 14]] },
  { id: 'm9', symbol: 'm9', name: 'Minor 9th', intervals: [[1, 0], [3, 3], [5, 7], [7, 10], [9, 14]] },
  { id: '7b9', symbol: '7♭9', name: 'Dominant 7th flat 9', intervals: [[1, 0], [3, 4], [5, 7], [7, 10], [9, 13]] },
  { id: '11', symbol: '11', name: 'Dominant 11th', intervals: [[1, 0], [3, 4], [5, 7], [7, 10], [9, 14], [11, 17]] },
  { id: 'm11', symbol: 'm11', name: 'Minor 11th', intervals: [[1, 0], [3, 3], [5, 7], [7, 10], [9, 14], [11, 17]] },
  { id: '13', symbol: '13', name: 'Dominant 13th', intervals: [[1, 0], [3, 4], [5, 7], [7, 10], [9, 14], [13, 21]] },
  { id: 'maj13', symbol: 'maj13', name: 'Major 13th', intervals: [[1, 0], [3, 4], [5, 7], [7, 11], [9, 14], [13, 21]] },
];

export interface SpelledNote {
  pitch: Pitch;
  name: string;
  midi: number;
  interval: Interval;
  intervalName: string;
}

/**
 * Notes of a chord or scale from a root in an octave, ascending. `inversion` moves that many of the
 * lowest notes up an octave (chords only).
 */
export function build(root: Pitch, octave: number, intervals: Interval[], inversion = 0): SpelledNote[] {
  const base = midiOf(root, octave);
  const notes = intervals.map((iv) => {
    const p = transpose(root, iv);
    return { pitch: p, name: spell(p), midi: base + iv[1], interval: iv, intervalName: intervalName(iv) };
  });
  for (let i = 0; i < inversion % notes.length; i++) {
    // Each inversion raises the current lowest note by an octave.
    const low = notes.reduce((a, b) => (b.midi < a.midi ? b : a));
    low.midi += 12;
  }
  notes.sort((a, b) => a.midi - b.midi);
  return notes;
}

/** Spell a note in an octave of a chord voicing; convenience for tables. */
export const chordSymbol = (root: Pitch, chord: ChordType, bass?: Pitch) =>
  `${spell(root)}${chord.symbol}${bass && pitchClass(bass) !== pitchClass(root) ? `/${spell(bass)}` : ''}`;

export interface DiatonicChord {
  degree: number;
  roman: string;
  root: Pitch;
  chord: ChordType;
  symbol: string;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Triads (or 7th chords) built on each degree of a heptatonic scale. */
export function diatonicChords(root: Pitch, scale: ScaleType, sevenths = false): DiatonicChord[] {
  if (!scale.heptatonic) return [];
  const semis = scale.intervals.map(([, s]) => s);
  return semis.map((_, i) => {
    const at = (k: number) => (semis[(i + k) % 7] - semis[i] + 12) % 12;
    const third = at(2);
    const fifth = at(4);
    const seventh = at(6);
    const pick = (ids: string[]) => CHORDS.find((c) => ids.includes(c.id))!;
    let chord: ChordType;
    if (!sevenths) chord = third === 4 ? (fifth === 8 ? pick(['aug']) : pick(['maj'])) : fifth === 6 ? pick(['dim']) : pick(['min']);
    else if (third === 4) chord = fifth === 8 ? pick(['aug7']) : seventh === 11 ? pick(['maj7']) : pick(['7']);
    else if (fifth === 6) chord = seventh === 9 ? pick(['dim7']) : pick(['m7b5']);
    else chord = seventh === 11 ? pick(['mMaj7']) : pick(['m7']);
    const r = transpose(root, scale.intervals[i]);
    const minorish = third === 3;
    let roman = minorish ? ROMAN[i].toLowerCase() : ROMAN[i];
    if (chord.id === 'dim' || chord.id === 'dim7') roman += '°';
    else if (chord.id === 'm7b5') roman += 'ø';
    else if (chord.id === 'aug' || chord.id === 'aug7') roman += '+';
    if (sevenths) roman += chord.id === 'maj7' || chord.id === 'mMaj7' ? 'maj7' : '7';
    return { degree: i + 1, roman, root: r, chord, symbol: chordSymbol(r, chord) };
  });
}

/* ---------------- Chord recognition ---------------- */

export interface Match {
  root: number;
  chord: ChordType;
  /** Pitch class of the lowest note, if it is not the root (slash chord / inversion). */
  bass?: number;
  /** Lower is better. */
  score: number;
  name: string;
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/**
 * Name the chord formed by a set of MIDI notes. Tries every pitch class as a root against every chord
 * type; prefers exact matches, then root position, then fewer extensions. Returns best first.
 */
export function identifyChord(midiNotes: number[]): Match[] {
  if (midiNotes.length < 2) return [];
  const pcs = [...new Set(midiNotes.map((n) => ((n % 12) + 12) % 12))];
  if (pcs.length < 2) return [];
  const bassPc = ((Math.min(...midiNotes) % 12) + 12) % 12;
  const out: Match[] = [];
  for (const root of pcs) {
    const rel = new Set(pcs.map((p) => (p - root + 12) % 12));
    for (const chord of CHORDS) {
      const want = new Set(chord.intervals.map(([, s]) => s % 12));
      const missing = [...want].filter((x) => !rel.has(x));
      const extra = [...rel].filter((x) => !want.has(x));
      if (extra.length) continue;
      // Allow an omitted fifth in chords with four or more notes.
      const okMissing = missing.length === 0 || (missing.length === 1 && missing[0] === 7 && want.size >= 4);
      if (!okMissing) continue;
      const inverted = root !== bassPc;
      const score = missing.length * 3 + (inverted ? 2 : 0) + chord.intervals.length * 0.1 + (chord.id === '5' ? 1 : 0);
      const name = `${SHARP_NAMES[root]}${chord.symbol}${inverted ? `/${SHARP_NAMES[bassPc]}` : ''}${missing.length ? ' (no 5)' : ''}`;
      out.push({ root, chord, ...(inverted ? { bass: bassPc } : {}), score, name });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}
