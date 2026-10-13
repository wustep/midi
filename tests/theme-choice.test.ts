import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { THEMES } from '../src/themes/registry.ts';
import { bootScript, modeFor, pickRandom, randomPool, wantedMode, type BootTable } from '../src/themes/choose.ts';
import type { Mode } from '../src/themes/types.ts';

// The registry as the boot script sees it (no font preloads: font-files.ts needs Vite).
const TABLE: BootTable = Object.fromEntries(
  THEMES.map((t) => {
    const m = (['light', 'dark'] as const).filter((k) => t[k]);
    return [t.id, { m, c: Object.fromEntries(m.map((k) => [k, t[k]!.bg])), f: [] }];
  }),
);
const IDS = Object.keys(TABLE);
const ONLY: Record<string, Mode> = Object.fromEntries(THEMES.filter((t) => !t.light || !t.dark).map((t) => [t.id, t.light ? 'light' : 'dark']));

/** Random values that land on every slot of a pool of up to `n`: 0, 1/n, 2/n, … */
const spread = (n = 60) => Array.from({ length: n }, (_, i) => i / n);

/* ---------- The rules (choose.ts) ---------- */

test('the random pool is the themes with the wanted mode', () => {
  const light = randomPool(TABLE, 'light');
  const dark = randomPool(TABLE, 'dark');
  assert.deepEqual(light, IDS.filter((id) => TABLE[id].m.includes('light')));
  assert.deepEqual(dark, IDS.filter((id) => TABLE[id].m.includes('dark')));
  // The registry as it ships: no dark-only themes in light mode, no light-only ones in dark mode.
  for (const id of ['rhythm', 'phosphor', 'after-hours']) assert.ok(!light.includes(id), `${id} is dark only`);
  assert.ok(!dark.includes('riso'), 'riso is light only');
  assert.equal(light.length + dark.length, IDS.length * 2 - Object.keys(ONLY).length);
});

test('with no theme in the wanted mode, the pool is every theme', () => {
  const darkOnly = { a: { m: ['dark'] as Mode[] }, b: { m: ['dark'] as Mode[] } };
  assert.deepEqual(randomPool(darkOnly, 'light'), ['a', 'b']);
  assert.deepEqual(randomPool(darkOnly, 'dark'), ['a', 'b']);
});

test('pickRandom reaches the whole pool and nothing else', () => {
  for (const want of ['light', 'dark'] as const) {
    const got = new Set(spread().map((r) => pickRandom(TABLE, want, undefined, () => r)));
    assert.deepEqual([...got].sort(), randomPool(TABLE, want).sort(), want);
  }
});

test('Surprise me never lands on the theme that is on, unless it is the only one', () => {
  for (const want of ['light', 'dark'] as const) {
    for (const not of IDS) {
      const got = new Set(spread().map((r) => pickRandom(TABLE, want, not, () => r)));
      assert.ok(!got.has(not), `${want}: re-rolled onto ${not}`);
      assert.deepEqual([...got].sort(), randomPool(TABLE, want).filter((id) => id !== not).sort());
    }
  }
  assert.equal(pickRandom({ solo: { m: ['light'] } }, 'dark', 'solo', () => 0.5), 'solo');
});

test('wanted mode: the reader’s pick, else the system', () => {
  assert.equal(wantedMode(null, true), 'dark');
  assert.equal(wantedMode(null, false), 'light');
  assert.equal(wantedMode('light', true), 'light');
  assert.equal(wantedMode('dark', false), 'dark');
  assert.equal(wantedMode('auto', true), 'dark');
  assert.equal(wantedMode('nonsense', false), 'light');
});

test('a one-mode theme forces its mode; a two-mode theme takes the wanted one', () => {
  assert.equal(modeFor(['dark'], 'light'), 'dark');
  assert.equal(modeFor(['light'], 'dark'), 'light');
  assert.equal(modeFor(['light', 'dark'], 'dark'), 'dark');
  assert.equal(modeFor(['light', 'dark'], 'light'), 'light');
});

/* ---------- The boot script, run as the browser runs it ---------- */

interface Page {
  theme: string;
  mode: string;
  themeColor: string;
  store: Record<string, string>;
}

/**
 * Runs the inline boot script against a fake page. `store` is localStorage (null: blocked, so reading it
 * throws, as with cookies off); `dark` is prefers-color-scheme; `random` is what Math.random returns.
 */
function boot({ store = {}, dark = false, random = 0 }: { store?: Record<string, string> | null; dark?: boolean; random?: number }): Page {
  const attrs: Record<string, string> = {};
  const meta: Record<string, string> = {};
  const saved = store ? { ...store } : {};
  const ctx: Record<string, unknown> = {
    document: {
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? { setAttribute: (k: string, v: string) => (meta[k] = v) } : null),
      createElement: () => ({}),
      head: { appendChild: () => {} },
    },
    matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' && dark }),
  };
  Object.defineProperty(ctx, 'localStorage', {
    get() {
      if (!store) throw new Error('SecurityError: storage is blocked');
      return { getItem: (k: string) => saved[k] ?? null, setItem: (k: string, v: string) => (saved[k] = String(v)) };
    },
  });
  vm.createContext(ctx);
  vm.runInContext(`Math.random = () => ${random};`, ctx);
  vm.runInContext(bootScript(TABLE), ctx);
  return { theme: attrs['data-theme'], mode: attrs['data-mode'], themeColor: meta.content, store: saved };
}

test('first visit in light mode: a random theme with a light mode, saved', () => {
  const seen = new Set<string>();
  for (const random of spread()) {
    const p = boot({ dark: false, random });
    assert.ok(TABLE[p.theme].m.includes('light'), `${p.theme} has no light mode`);
    assert.equal(p.mode, 'light');
    assert.deepEqual(p.store, { theme: p.theme });
    assert.equal(p.themeColor, TABLE[p.theme].c.light);
    seen.add(p.theme);
  }
  assert.deepEqual([...seen].sort(), randomPool(TABLE, 'light').sort());
});

test('first visit in dark mode: a random theme with a dark mode, saved', () => {
  const seen = new Set<string>();
  for (const random of spread()) {
    const p = boot({ dark: true, random });
    assert.ok(TABLE[p.theme].m.includes('dark'), `${p.theme} has no dark mode`);
    assert.equal(p.mode, 'dark');
    assert.deepEqual(p.store, { theme: p.theme });
    seen.add(p.theme);
  }
  assert.deepEqual([...seen].sort(), randomPool(TABLE, 'dark').sort());
});

test('the saved theme holds across pages, reloads and system changes', () => {
  for (const first of [false, true]) {
    for (const random of spread(12)) {
      const visit = boot({ dark: first, random });
      // Later page loads roll different numbers, and the system may have switched.
      for (const dark of [false, true]) {
        const later = boot({ store: visit.store, dark, random: 0.999 - random });
        assert.equal(later.theme, visit.theme);
        assert.equal(later.mode, ONLY[visit.theme] ?? (dark ? 'dark' : 'light'));
        assert.deepEqual(later.store, visit.store, 'nothing new is written');
      }
    }
  }
});

test('a picked theme holds, and a one-mode theme forces its mode', () => {
  for (const id of IDS) {
    for (const dark of [false, true]) {
      const p = boot({ store: { theme: id }, dark, random: 0.5 });
      assert.equal(p.theme, id);
      assert.equal(p.mode, ONLY[id] ?? (dark ? 'dark' : 'light'));
      assert.equal(p.themeColor, TABLE[id].c[p.mode as Mode]);
    }
  }
  // Dark-only picks stay dark when the system is light, and Riso stays light when it's dark.
  assert.equal(boot({ store: { theme: 'phosphor' }, dark: false }).mode, 'dark');
  assert.equal(boot({ store: { theme: 'riso' }, dark: true }).mode, 'light');
});

test('a picked Light or Dark wins over the system, and filters the first roll', () => {
  for (const random of spread()) {
    const p = boot({ store: { 'theme-mode': 'light' }, dark: true, random });
    assert.ok(randomPool(TABLE, 'light').includes(p.theme));
    assert.equal(p.mode, 'light');
  }
  assert.equal(boot({ store: { theme: 'field-guide', 'theme-mode': 'dark' }, dark: false }).mode, 'dark');
});

test('the old theme=light|dark setting becomes a saved mode, then a theme is rolled for it', () => {
  for (const random of spread()) {
    const p = boot({ store: { theme: 'dark' }, dark: false, random });
    assert.ok(randomPool(TABLE, 'dark').includes(p.theme));
    assert.equal(p.mode, 'dark');
    assert.deepEqual(p.store, { theme: p.theme, 'theme-mode': 'dark' });
  }
});

test('a saved theme that no longer exists is rolled again', () => {
  for (const bad of ['retired-theme', 'constructor', '']) {
    const p = boot({ store: { theme: bad }, dark: true, random: 0.3 });
    assert.ok(randomPool(TABLE, 'dark').includes(p.theme), bad);
    assert.equal(p.store.theme, p.theme);
  }
});

test('with storage blocked, the first theme with the mode, the same on every page', () => {
  for (const dark of [false, true]) {
    const want = dark ? 'dark' : 'light';
    for (const random of spread(8)) {
      const p = boot({ store: null, dark, random });
      assert.equal(p.theme, randomPool(TABLE, want)[0]);
      assert.equal(p.mode, modeFor(TABLE[p.theme].m, want));
    }
  }
});
