/**
 * Shared parts for theme files: textures and shadow recipes. Textures are CSS backgrounds drawn in
 * the theme's own --line colors, so they follow light and dark. Each includes its own tile size.
 */

/** A step sequencer's grid: steps every 24px, a heavier line every bar of four. */
export const steps =
  'linear-gradient(90deg, var(--line-strong) 1px, transparent 1px) 0 0 / 96px 96px, linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 24px 24px';

/** A perforated panel: a dot every 16px. */
export const dots = 'radial-gradient(circle, var(--line-strong) 1.1px, transparent 1.6px) 0 0 / 16px 16px';

/** A piano roll: one 12px lane per semitone, black-key lanes shaded, and beat lines every 48px. */
export const lanes = [
  'linear-gradient(90deg, var(--line-strong) 1px, transparent 1px) 0 0 / 192px 100%',
  'linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 48px 100%',
  // B A# A G# G F# F E D# D C# C, top to bottom
  'linear-gradient(transparent 0 12px, var(--surface-2) 12px 24px, transparent 24px 36px, var(--surface-2) 36px 48px, transparent 48px 60px, var(--surface-2) 60px 72px, transparent 72px 96px, var(--surface-2) 96px 108px, transparent 108px 120px, var(--surface-2) 120px 132px, transparent 132px 143px, var(--line-strong) 143px 144px) 0 0 / 100% 144px',
].join(', ');

/** Music staves: five lines, 8px apart, a stave every 88px. */
export const staves = 'linear-gradient(transparent 0 32px, var(--line-strong) 32px 33px, transparent 33px 40px, var(--line-strong) 40px 41px, transparent 41px 48px, var(--line-strong) 48px 49px, transparent 49px 56px, var(--line-strong) 56px 57px, transparent 57px 64px, var(--line-strong) 64px 65px, transparent 65px) 0 0 / 100% 88px';

/** Drafting paper: a fine 12px grid with a major line every 60px. */
export const drafting =
  'linear-gradient(var(--line-strong) 1px, transparent 1px) 0 0 / 60px 60px, linear-gradient(90deg, var(--line-strong) 1px, transparent 1px) 0 0 / 60px 60px, linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 12px 12px';

/** A CRT's scanlines. */
export const scanlines = 'repeating-linear-gradient(var(--line-strong) 0 1px, transparent 1px 4px)';

/** Printer's grain: fractal noise at low alpha, multiplied over the page. */
export const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .2 0 0 0 0 .18 0 0 0 0 .3 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ---------- Shadows ---------- */

type Shadows = Record<'shadow-1' | 'shadow-2' | 'shadow-3' | 'shadow-inset', string>;

/** Short, lit-from-above shadows tinted toward `rgb` ("60 45 20"), with a highlight on top edges. */
export const softLight = (rgb: string, highlight = 'rgb(255 255 255 / 0.7)'): Shadows => ({
  'shadow-1': `0 1px 0 ${highlight} inset, 0 1px 2px rgb(${rgb} / 0.08)`,
  'shadow-2': `0 1px 0 ${highlight} inset, 0 1px 2px rgb(${rgb} / 0.06), 0 8px 20px -10px rgb(${rgb} / 0.22)`,
  'shadow-3': `0 1px 2px rgb(${rgb} / 0.08), 0 24px 64px -20px rgb(${rgb} / 0.4)`,
  'shadow-inset': `inset 0 1px 2px rgb(${rgb} / 0.08)`,
});

/** Dark-mode depth: black shadows and a faint lit edge. */
export const softDark = (edge = 0.05): Shadows => ({
  'shadow-1': `0 1px 0 rgb(255 255 255 / ${edge * 0.8}) inset, 0 1px 2px rgb(0 0 0 / 0.4)`,
  'shadow-2': `0 1px 0 rgb(255 255 255 / ${edge}) inset, 0 1px 2px rgb(0 0 0 / 0.4), 0 10px 28px -12px rgb(0 0 0 / 0.7)`,
  'shadow-3': `0 1px 0 rgb(255 255 255 / ${edge * 1.2}) inset, 0 28px 72px -20px rgb(0 0 0 / 0.8)`,
  'shadow-inset': 'inset 0 1px 2px rgb(0 0 0 / 0.5)',
});

/** No elevation: printed or drawn themes separate things with rules, not shadows. */
export const flat = (floating: string): Shadows => ({
  'shadow-1': 'none',
  'shadow-2': 'none',
  'shadow-3': floating,
  'shadow-inset': 'none',
});
