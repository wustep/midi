import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, DEFAULT_THEME } from '../src/themes/registry.ts';
import { FONTS } from '../src/themes/fonts.ts';
import type { Palette } from '../src/themes/types.ts';

/** WCAG 2 relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type K = keyof Palette;
const TEXT = 4.5; // WCAG AA, normal text
const UI = 3; // WCAG AA, non-text contrast (control borders, focus rings, indicators, chart marks)
const SURFACES: K[] = ['bg', 'surface', 'surface-2', 'surface-sunken', 'surface-raised'];

/** Every pairing the site draws, with the ratio it needs. Foreground first. */
const PAIRS: [K, K, number][] = [
  // Body text, secondary text and meta text, on every surface.
  ...(['ink', 'ink-2', 'muted'] as K[]).flatMap((fg) => SURFACES.map((bg): [K, K, number] => [fg, bg, TEXT])),
  // Links and status bytes; data bytes and success; meta and SysEx; cautions. On the page, on cards and
  // panels, in wells and table heads, and on their own tinted chips.
  ...(['accent', 'data', 'meta', 'warn'] as K[]).flatMap((fg) => (['bg', 'surface', 'surface-sunken', 'surface-raised', `${fg}-soft` as K] as K[]).map((bg): [K, K, number] => [fg, bg, TEXT])),
  ['accent-hover', 'bg', TEXT],
  ['accent-hover', 'surface', TEXT],
  ['on-accent', 'accent', TEXT],
  ['on-primary', 'primary', TEXT],
  ['on-primary', 'primary-hover', TEXT],
  // Selected text and pressed chips (ink on the soft accent, page color on ink).
  ['ink', 'accent-soft', TEXT],
  ['bg', 'ink', TEXT],
  ['bg', 'ink-2', TEXT],
  // The "C4" label on a white key.
  ['key-label', 'key-w', TEXT],
  // Non-text: field borders, the focus ring, black keys against white, lit LEDs, chart series.
  ['control', 'bg', UI],
  ['control', 'surface', UI],
  ['control', 'surface-sunken', UI],
  ['focus', 'bg', UI],
  ['focus', 'surface', UI],
  ['focus', 'surface-raised', UI],
  ['key-b', 'key-w', UI],
  ['led', 'surface', UI],
  ['sky', 'surface', UI],
  ['olive', 'surface', UI],
  ['accent', 'surface', UI],
  ['data', 'surface', UI],
];

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_KEYS: K[] = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

test('the registry has themes, unique ids, and the default first', () => {
  assert.ok(THEMES.length >= 1);
  assert.equal(DEFAULT_THEME, THEMES[0]);
  const ids = THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate theme ids: ${ids}`);
  for (const t of THEMES) {
    assert.match(t.id, /^[a-z][a-z0-9-]*$/, `${t.id}: ids are lowercase kebab-case`);
    assert.ok(t.light || t.dark, `${t.id}: needs a light or a dark palette`);
    assert.ok(t.name && t.direction, `${t.id}: needs a name and a one-line direction`);
  }
});

test('every theme font is in the catalog and has files', () => {
  const files = readFileSync(new URL('../src/themes/font-files.ts', import.meta.url), 'utf8');
  for (const t of THEMES) {
    for (const key of Object.values(t.fonts)) {
      assert.ok(FONTS[key], `${t.id}: unknown font ${key}`);
      assert.match(files, new RegExp(`^  '?${key}'?: \\[`, 'm'), `${t.id}: ${key} has no entry in font-files.ts`);
    }
  }
});

for (const t of THEMES) {
  for (const mode of ['light', 'dark'] as const) {
    const p = t[mode];
    if (!p) continue;
    test(`${t.name} (${mode}) meets WCAG AA`, () => {
      for (const k of COLOR_KEYS) assert.match(p[k], HEX, `${t.id} ${mode}: --${k} must be #rrggbb (it's checked for contrast)`);
      const failures = PAIRS.filter(([fg, bg, min]) => contrast(p[fg], p[bg]) < min).map(
        ([fg, bg, min]) => `--${fg} ${p[fg]} on --${bg} ${p[bg]}: ${contrast(p[fg], p[bg]).toFixed(2)} < ${min}`,
      );
      assert.deepEqual(failures, [], `${t.id} ${mode}:\n  ${failures.join('\n  ')}`);
    });
  }
}
