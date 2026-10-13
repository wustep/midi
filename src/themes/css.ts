/**
 * Turns the registry into what the page needs, at build time:
 *   - themeCss():   @font-face for the fonts registered themes use, then one block of custom properties
 *                   per theme and mode, keyed on <html data-theme data-mode>.
 *   - bootScript(): the inline script in <head> that picks the theme before first paint (no flash),
 *                   points <meta name="theme-color"> at it and preloads its fonts.
 */
import { THEMES, DEFAULT_THEME } from './registry.ts';
import { FONTS, fontStack } from './fonts.ts';
import { FONT_FILES } from './font-files.ts';
import { iconDocument } from '../lib/icons.mjs';
import type { FontKey, Mode, Palette, Theme } from './types.ts';

export const modesOf = (t: Theme): Mode[] => (['light', 'dark'] as const).filter((m) => t[m]);
const paletteOf = (t: Theme, m: Mode) => t[m] ?? t.light ?? t.dark!;
const fontsOf = (t: Theme): FontKey[] => [...new Set([t.fonts.display, t.fonts.text, t.fonts.mono, t.fonts.label ?? t.fonts.display])];
const svgUrl = (svg: string) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;

function fontFaces(): string {
  const used = new Set(THEMES.flatMap(fontsOf));
  return [...used]
    .flatMap((key) =>
      FONT_FILES[key].map(
        (f) =>
          `@font-face{font-family:'${FONTS[key].family}';src:url('${f.src}') format('woff2');font-weight:${f.weight};font-style:${f.style ?? 'normal'};${f.stretch ? `font-stretch:${f.stretch};` : ''}font-display:swap}`,
      ),
    )
    .join('\n');
}

function paletteVars(p: Palette, mode: Mode): string {
  const vars = Object.entries(p).map(([k, v]) => `--${k}:${v}`);
  // The select chevron is a background image, so it carries its color: the icon-set chevron in --muted.
  vars.push(`--i-select:${svgUrl(iconDocument('chevron-down', p.muted))}`, `color-scheme:${mode}`);
  return vars.join(';');
}

function baseVars(t: Theme): string {
  const f = t.fonts;
  const vars: string[] = [
    `--font-display:${fontStack(f.display)}`,
    `--font-text:${fontStack(f.text)}`,
    `--font-mono:${fontStack(f.mono)}`,
    `--font-label:${fontStack(f.label ?? f.display)}`,
  ];
  for (const [k, v] of Object.entries(t.vars ?? {})) vars.push(`${k}:${v}`);
  return vars.join(';');
}

export function themeCss(): string {
  const out = [fontFaces()];
  for (const t of THEMES) {
    const modes = modesOf(t);
    const first = modes[0];
    const isDefault = t.id === DEFAULT_THEME.id;
    // Without JavaScript there's no data-theme: the default theme applies, following the system's light or dark.
    const sel = `:root[data-theme="${t.id}"]${isDefault ? ',:root:not([data-theme])' : ''}`;
    out.push(`${sel}{${baseVars(t)};${paletteVars(paletteOf(t, first), first)}}`);
    if (modes.length > 1) {
      out.push(`:root[data-theme="${t.id}"][data-mode="dark"]{${paletteVars(t.dark!, 'dark')}}`);
      if (isDefault) out.push(`@media (prefers-color-scheme:dark){:root:not([data-theme]){${paletteVars(t.dark!, 'dark')}}}`);
    }
    // Doubled :root so a theme's own rules outrank component styles of the same shape.
    if (t.css) out.push(`:root:root[data-theme="${t.id}"]{${t.css}}`);
  }
  return out.join('\n');
}

export interface Swatch {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  data: string;
  dataSoft: string;
  meta: string;
  metaSoft: string;
  primary: string;
  onPrimary: string;
  led: string;
}

/** What the picker and /design/ need to know about each theme. */
export function themeSummary(t: Theme) {
  const modes = modesOf(t);
  return {
    id: t.id,
    name: t.name,
    direction: t.direction,
    modes,
    /** Swatch colors per mode, for the picker and /design/. */
    swatch: Object.fromEntries(
      modes.map((m) => {
        const p = paletteOf(t, m);
        return [
          m,
          {
            bg: p.bg,
            surface: p.surface,
            ink: p.ink,
            muted: p.muted,
            line: p['line-strong'],
            accent: p.accent,
            accentSoft: p['accent-soft'],
            data: p.data,
            dataSoft: p['data-soft'],
            meta: p.meta,
            metaSoft: p['meta-soft'],
            primary: p.primary,
            onPrimary: p['on-primary'],
            led: p.led,
          },
        ];
      }),
    ) as Partial<Record<Mode, Swatch>>,
    displayFont: fontStack(t.fonts.display),
    textFont: fontStack(t.fonts.text),
    monoFont: fontStack(t.fonts.mono),
    /** Family names, for people: "Fraunces, Newsreader, IBM Plex Mono". */
    fontNames: [...new Set([t.fonts.display, t.fonts.text, t.fonts.mono, t.fonts.label ?? t.fonts.display])].map((k) => FONTS[k].family.replace(/ Variable$/, '')),
  };
}

export function bootScript(): string {
  const data = {
    d: DEFAULT_THEME.id,
    t: Object.fromEntries(
      THEMES.map((t) => {
        const modes = modesOf(t);
        // Preload the text and display faces (the first file of each); they paint the first screen.
        const preload = [...new Set([t.fonts.text, t.fonts.display])].map((k) => FONT_FILES[k][0].src);
        return [t.id, { m: modes, c: Object.fromEntries(modes.map((m) => [m, paletteOf(t, m).bg])), f: preload }];
      }),
    ),
  };
  return `(function(){var B=${JSON.stringify(data)},r=document.documentElement,id,m;
try{id=localStorage.getItem('theme');m=localStorage.getItem('theme-mode')}catch(e){}
if(id==='light'||id==='dark'){m=id;id=null}
var t=B.t[id]?id:B.d,T=B.t[t],mode=T.m.length<2?T.m[0]:m==='light'||m==='dark'?m:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
r.setAttribute('data-theme',t);r.setAttribute('data-mode',mode);
var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute('content',T.c[mode]);
T.f.forEach(function(u){var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='';l.href=u;document.head.appendChild(l)})})();`;
}
