import type { FontKey } from './types.ts';

/**
 * Every typeface a theme can use: the CSS family name and its fallback stack. The font files are in
 * ./font-files.ts. All fonts are self-hosted and OFL-licensed, Latin subset only. A browser downloads
 * a font only when text on the page uses it, so only the active theme's fonts load.
 */
export const FONTS: Record<FontKey, { family: string; fallback: string }> = {
  archivo: { family: 'Archivo Variable', fallback: "'Archivo', ui-sans-serif, system-ui, sans-serif" },
  'atkinson-next': { family: 'Atkinson Hyperlegible Next Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'atkinson-mono': { family: 'Atkinson Hyperlegible Mono Variable', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  'sofia-sans': { family: 'Sofia Sans Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'sofia-sans-condensed': { family: 'Sofia Sans Condensed Variable', fallback: "'Arial Narrow', ui-sans-serif, system-ui, sans-serif" },
  'instrument-sans': { family: 'Instrument Sans Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'martian-mono': { family: 'Martian Mono Variable', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  fraunces: { family: 'Fraunces Variable', fallback: "Georgia, 'Times New Roman', serif" },
  newsreader: { family: 'Newsreader Variable', fallback: "Georgia, 'Times New Roman', serif" },
  'plex-sans': { family: 'IBM Plex Sans Variable', fallback: "'Helvetica Neue', ui-sans-serif, system-ui, sans-serif" },
  'plex-mono': { family: 'IBM Plex Mono', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  'jetbrains-mono': { family: 'JetBrains Mono Variable', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  'dm-sans': { family: 'DM Sans Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'dm-mono': { family: 'DM Mono', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  inter: { family: 'Inter Variable', fallback: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif" },
  'inter-tight': { family: 'Inter Tight Variable', fallback: "'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif" },
  bricolage: { family: 'Bricolage Grotesque Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'space-mono': { family: 'Space Mono', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  jost: { family: 'Jost Variable', fallback: "Futura, 'Century Gothic', ui-sans-serif, sans-serif" },
  michroma: { family: 'Michroma', fallback: "Eurostile, 'Microgramma', ui-sans-serif, sans-serif" },
  'red-hat-mono': { family: 'Red Hat Mono Variable', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  unbounded: { family: 'Unbounded Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  sora: { family: 'Sora Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  geist: { family: 'Geist Variable', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  'geist-mono': { family: 'Geist Mono Variable', fallback: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
};

/** The CSS font-family value for a font key. */
export const fontStack = (key: FontKey) => `'${FONTS[key].family}', ${FONTS[key].fallback}`;
