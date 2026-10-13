/**
 * Colors worked out from a palette at build time, so themes don't have to spell them out. css.ts
 * writes them next to the palette's own custom properties; tests/themes.test.ts checks them for
 * contrast like the rest.
 */
import type { Mode, Palette } from './types.ts';

/** Mixes two #rrggbb colors in sRGB, `p` of `a` (what CSS `color-mix(in srgb, a p, b)` gives). */
export function mixHex(a: string, b: string, p: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0')).join('');
}

/**
 * Piano keys, for every keyboard on the site:
 *   - `key-on`: a pressed white key. In light mode the soft accent; in dark mode the soft accent is near
 *     black, so a pressed key would read as a hole. There it's lit instead: the accent mixed into the key.
 *   - `key-on-label`: text on a pressed white key (the "C4" mark).
 *   - `key-edge`: the line between white keys. The palette's `key-edge`, else its strong hairline.
 */
export function keyColors(p: Palette, mode: Mode) {
  const dark = mode === 'dark';
  return {
    'key-on': dark ? mixHex(p.accent, p['key-w'], 0.55) : p['accent-soft'],
    'key-on-label': dark ? p['on-accent'] : p['key-label'],
    'key-edge': p['key-edge'] ?? p['line-strong'],
  };
}
