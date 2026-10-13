/**
 * The shape of a theme. A theme is plain data: colors per mode, three or four font keys, and a few
 * type and shape settings. src/themes/css.ts turns the registered themes into CSS custom properties,
 * so components never know which theme is on. See docs/THEMES.md.
 */

/** Semantic colors and elevation for one mode. Every key becomes a `--key` custom property. */
export interface Palette {
  /** The page. */
  bg: string;
  /** Raised: cards, panels, tables, buttons. */
  surface: string;
  /** Hover fills, neutral badges. */
  'surface-2': string;
  /** Wells: inputs, code, readouts, table heads. */
  'surface-sunken': string;
  /** Floating: popovers, dialogs, the selected segment. */
  'surface-raised': string;
  /** Text, from primary to meta. `muted` is at least 4.5:1 on every surface. */
  ink: string;
  'ink-2': string;
  muted: string;
  /** Hairlines, raised edges, and field borders (`control` is at least 3:1). */
  line: string;
  'line-strong': string;
  control: string;
  /** Status bytes, links, the current section. */
  accent: string;
  'accent-hover': string;
  'accent-soft': string;
  'on-accent': string;
  /** The one primary action per view. */
  primary: string;
  'primary-hover': string;
  'on-primary': string;
  /** Data bytes, success. */
  data: string;
  'data-soft': string;
  /** Meta events, SysEx. */
  meta: string;
  'meta-soft': string;
  /** Cautions. */
  warn: string;
  'warn-soft': string;
  /** Keyboard focus only. */
  focus: string;
  /** Extra chart series (CC kinds). */
  sky: string;
  olive: string;
  /** A lit indicator: MIDI activity, the current page, the chosen theme. */
  led: string;
  /** Behind dialogs. Any CSS color. */
  scrim: string;
  /** Piano keys. */
  'key-w': string;
  'key-w-hover': string;
  'key-b': string;
  'key-label': string;
  /** Light catching the top edge of raised things (keycaps, buttons). Any CSS color. */
  highlight: string;
  /** Elevation. Any CSS box-shadow. */
  'shadow-1': string;
  'shadow-2': string;
  'shadow-3': string;
  'shadow-inset': string;
}

export type Mode = 'light' | 'dark';

/** Keys of the font catalog in src/themes/fonts.ts. */
export type FontKey =
  | 'archivo'
  | 'atkinson-next'
  | 'atkinson-mono'
  | 'sofia-sans'
  | 'sofia-sans-condensed'
  | 'instrument-sans'
  | 'martian-mono'
  | 'fraunces'
  | 'newsreader'
  | 'plex-sans'
  | 'plex-mono'
  | 'jetbrains-mono'
  | 'dm-sans'
  | 'dm-mono'
  | 'inter'
  | 'inter-tight'
  | 'bricolage'
  | 'space-mono'
  | 'jost'
  | 'michroma'
  | 'red-hat-mono'
  | 'unbounded'
  | 'sora'
  | 'geist'
  | 'geist-mono';

export interface Theme {
  /** URL-safe id, stored in localStorage and set as `<html data-theme>`. */
  id: string;
  name: string;
  /** One line on the direction, shown in the picker and on /design/. */
  direction: string;
  /** A theme has a light palette, a dark palette, or both. With both, it follows the system unless the reader picks. */
  light?: Palette;
  dark?: Palette;
  fonts: {
    display: FontKey;
    text: FontKey;
    mono: FontKey;
    /** Small uppercase labels: eyebrows, table heads, panel titles. Defaults to the display font. */
    label?: FontKey;
  };
  /**
   * Type, shape and texture settings, as custom properties. Defaults live in src/styles/tokens.css
   * (`--display-weight`, `--h1-stretch`, `--label-tracking`, `--r-md`, `--texture`, …).
   */
  vars?: Record<`--${string}`, string>;
  /**
   * A last resort for what tokens can't say. Nested CSS, scoped to this theme
   * (wrapped in `:root[data-theme="id"] { … }`). Keep it short.
   */
  css?: string;
}
