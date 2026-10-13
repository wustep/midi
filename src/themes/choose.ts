/**
 * How a visitor's theme is chosen. Two places do it, and they follow the same rules:
 *   - bootScript(): the inline script in <head>, before first paint. It keeps a saved theme, and on a
 *     first visit picks one at random and saves it. Written out as ES5 because it runs as is.
 *   - The picker (ThemePicker.astro): "Surprise me", the Auto / Light / Dark switch, a system change.
 *     It uses the functions below.
 * tests/theme-choice.test.ts runs the boot script and checks it against these functions.
 *
 * localStorage: `theme` is the theme id (random or picked, kept either way); `theme-mode` is `light` or
 * `dark` when the reader picked one (absent means follow the system).
 */
import type { Mode } from './types.ts';

/** Each registered theme's modes, keyed by id, in registry order. */
export type ModeTable = Record<string, { m: readonly Mode[] }>;

/** What the boot script needs per theme: modes, `<meta name="theme-color">` per mode, fonts to preload. */
export type BootTable = Record<string, { m: Mode[]; c: Partial<Record<Mode, string>>; f: string[] }>;

/** The mode a reader wants: Light or Dark if they picked one, otherwise the system's. */
export const wantedMode = (pref: string | null, systemDark: boolean): Mode =>
  pref === 'light' || pref === 'dark' ? pref : systemDark ? 'dark' : 'light';

/** The mode a theme shows: its only one, or the one wanted. */
export const modeFor = (modes: readonly Mode[], want: Mode): Mode => (modes.length < 2 ? modes[0] : want);

/** What a random pick draws from: the themes that have the wanted mode (every theme, if none has it). */
export function randomPool(themes: ModeTable, want: Mode): string[] {
  const ids = Object.keys(themes);
  const fit = ids.filter((id) => themes[id].m.includes(want));
  return fit.length ? fit : ids;
}

/** A random theme from the pool for `want`, never `not` (the current theme) when there's another to land on. */
export function pickRandom(themes: ModeTable, want: Mode, not?: string, random: () => number = Math.random): string {
  const pool = randomPool(themes, want);
  const others = pool.filter((id) => id !== not);
  const from = others.length ? others : pool;
  return from[Math.floor(random() * from.length)];
}

/**
 * The boot script. In order: read the saved theme and mode (the old `theme=light|dark` setting becomes
 * a mode); with no saved theme, or one that's been removed, pick a random theme from randomPool() and
 * save it (if storage is blocked, take the pool's first theme instead, so it holds from page to page);
 * then set <html data-theme data-mode> as modeFor() would, point theme-color at it and preload its fonts.
 */
export function bootScript(table: BootTable): string {
  return `(function(){var B=${JSON.stringify(table)},k=Object.keys(B),r=document.documentElement,ls=null,id,m;
try{ls=localStorage;id=ls.getItem('theme');m=ls.getItem('theme-mode')}catch(e){ls=null}
function save(n,v){if(ls)try{ls.setItem(n,v)}catch(e){}}
if(id==='light'||id==='dark'){m=id;id=null;save('theme-mode',m)}
var want=m==='light'||m==='dark'?m:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
if(k.indexOf(id)<0){var p=k.filter(function(i){return B[i].m.indexOf(want)>=0});if(!p.length)p=k;id=ls?p[Math.floor(Math.random()*p.length)]:p[0];save('theme',id)}
var T=B[id],mode=T.m.length<2?T.m[0]:want;
r.setAttribute('data-theme',id);r.setAttribute('data-mode',mode);
var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute('content',T.c[mode]);
T.f.forEach(function(u){var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='';l.href=u;document.head.appendChild(l)})})();`;
}
