import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICONS, iconSvg, iconDocument } from '../src/lib/icons.mjs';

/** Absolute coordinates a path or shape reaches (good enough for the simple paths in the set). */
function extents(body: string): number[][] {
  const pts: number[][] = [];
  // A 2px stroke reaches 1px beyond the geometry, except on shapes drawn with stroke="none".
  const pad = (tag: string) => (/stroke="none"/.test(tag) ? 0 : 1);
  for (const [tag, cx, cy, r] of body.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"[^>]*>/g)) {
    const e = +r + pad(tag);
    pts.push([+cx - e, +cy - e], [+cx + e, +cy + e]);
  }
  for (const [tag, x, y, w, h] of body.matchAll(/<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"[^>]*>/g)) {
    const e = pad(tag);
    pts.push([+x - e, +y - e], [+x + +w + e, +y + +h + e]);
  }
  for (const [, d] of body.matchAll(/ d="([^"]+)"/g)) {
    let x = 0, y = 0;
    for (const [, cmd, args] of d.matchAll(/([MmLlHhVvCcAaZz])([^MmLlHhVvCcAaZz]*)/g)) {
      const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const step = C === 'H' || C === 'V' ? 1 : C === 'C' ? 6 : C === 'A' ? 7 : 2;
      for (let i = 0; i + step <= n.length; i += step) {
        if (C === 'H') x = rel ? x + n[i] : n[i];
        else if (C === 'V') y = rel ? y + n[i] : n[i];
        else {
          const [nx, ny] = n.slice(i + step - 2, i + step);
          x = rel ? x + nx : nx;
          y = rel ? y + ny : ny;
        }
        pts.push([x - 1, y - 1], [x + 1, y + 1]);
      }
    }
  }
  return pts;
}

test('every icon stays inside the 2px safe area of the 24 grid (stroke included)', () => {
  for (const [name, def] of Object.entries(ICONS)) {
    for (const [x, y] of extents(def.body)) {
      assert.ok(x >= 2 - 1e-9 && x <= 22 + 1e-9 && y >= 2 - 1e-9 && y <= 22 + 1e-9, `${name}: point ${x},${y} outside 2–22`);
    }
  }
});

test('iconSvg shares one drawing style and is decorative unless labelled', () => {
  const s = iconSvg('search');
  assert.match(s, /viewBox="0 0 24 24"/);
  assert.match(s, /stroke-width="2"/);
  assert.match(s, /stroke-linecap="round"/);
  assert.match(s, /stroke-linejoin="round"/);
  assert.match(s, /aria-hidden="true"/);
  assert.match(iconSvg('play'), /fill="currentColor"/);
  const named = iconSvg('code', { label: 'Source on GitHub' });
  assert.match(named, /role="img"/);
  assert.match(named, /aria-label="Source on GitHub"/);
  assert.throws(() => iconSvg('nope'));
});

test('iconDocument resolves currentColor for image renderers', () => {
  assert.doesNotMatch(iconDocument('din', '#123456'), /currentColor/);
});

test('the chevrons drawn from CSS are the same paths as the icon set', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/%3C/g, '<').replace(/%3E/g, '>').replace(/%23/g, '#');
  for (const name of ['chevron-down', 'chevron-right']) {
    const d = ICONS[name].body.match(/d="([^"]+)"/)![1];
    assert.ok(css.includes(`d='${d}'`), `tokens.css is missing the ${name} path ${d}`);
  }
});
