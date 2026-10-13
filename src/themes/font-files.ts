/**
 * The font files behind src/themes/fonts.ts, as @font-face sources. Vite fingerprints and copies each
 * file at build time; src/themes/css.ts writes @font-face rules only for fonts a registered theme uses.
 * Astro-only (the `?url` imports need Vite), so tests import fonts.ts, never this file.
 */
import type { FontKey } from './types.ts';
import atkinsonNext from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url';
import atkinsonNextItalic from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-italic.woff2?url';
import atkinsonMono from '@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2?url';
import sofiaSans from '@fontsource-variable/sofia-sans/files/sofia-sans-latin-wght-normal.woff2?url';
import sofiaSansItalic from '@fontsource-variable/sofia-sans/files/sofia-sans-latin-wght-italic.woff2?url';
import sofiaCond from '@fontsource-variable/sofia-sans-condensed/files/sofia-sans-condensed-latin-wght-normal.woff2?url';
import instrumentSans from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2?url';
import instrumentSansItalic from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-italic.woff2?url';
import martianMono from '@fontsource-variable/martian-mono/files/martian-mono-latin-standard-normal.woff2?url';
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-standard-normal.woff2?url';
import frauncesItalic from '@fontsource-variable/fraunces/files/fraunces-latin-standard-italic.woff2?url';
import newsreader from '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url';
import newsreaderItalic from '@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2?url';
import plexSans from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-standard-normal.woff2?url';
import plexSansItalic from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-standard-italic.woff2?url';
import plexMono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import plexMono400i from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-italic.woff2?url';
import plexMono600 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url';
import jetbrainsMono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import dmSans from '@fontsource-variable/dm-sans/files/dm-sans-latin-standard-normal.woff2?url';
import dmSansItalic from '@fontsource-variable/dm-sans/files/dm-sans-latin-standard-italic.woff2?url';
import dmMono400 from '@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2?url';
import dmMono500 from '@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2?url';
import inter from '@fontsource-variable/inter/files/inter-latin-standard-normal.woff2?url';
import interItalic from '@fontsource-variable/inter/files/inter-latin-standard-italic.woff2?url';
import interTight from '@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2?url';
import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2?url';
import spaceMono400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import spaceMono700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import jost from '@fontsource-variable/jost/files/jost-latin-wght-normal.woff2?url';
import jostItalic from '@fontsource-variable/jost/files/jost-latin-wght-italic.woff2?url';
import michroma from '@fontsource/michroma/files/michroma-latin-400-normal.woff2?url';
import redHatMono from '@fontsource-variable/red-hat-mono/files/red-hat-mono-latin-wght-normal.woff2?url';
import unbounded from '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?url';
import sora from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';
import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url';
import geistItalic from '@fontsource-variable/geist/files/geist-latin-wght-italic.woff2?url';
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url';

export interface FontFace {
  src: string;
  weight: string;
  style?: 'normal' | 'italic';
  stretch?: string;
}

/** The first face of each font is the one preloaded when its theme is active. */
export const FONT_FILES: Record<FontKey, FontFace[]> = {
  // Archivo is subset and instanced by hand (public/fonts/Archivo-OFL.txt): weights 400–900, widths 100–125%.
  archivo: [{ src: '/fonts/archivo-display.woff2', weight: '400 900', stretch: '100% 125%' }],
  'atkinson-next': [
    { src: atkinsonNext, weight: '200 800' },
    { src: atkinsonNextItalic, weight: '200 800', style: 'italic' },
  ],
  'atkinson-mono': [{ src: atkinsonMono, weight: '200 800' }],
  'sofia-sans': [
    { src: sofiaSans, weight: '1 1000' },
    { src: sofiaSansItalic, weight: '1 1000', style: 'italic' },
  ],
  'sofia-sans-condensed': [{ src: sofiaCond, weight: '1 1000' }],
  'instrument-sans': [
    { src: instrumentSans, weight: '400 700', stretch: '75% 100%' },
    { src: instrumentSansItalic, weight: '400 700', stretch: '75% 100%', style: 'italic' },
  ],
  'martian-mono': [{ src: martianMono, weight: '100 800', stretch: '75% 112.5%' }],
  fraunces: [
    { src: fraunces, weight: '100 900' },
    { src: frauncesItalic, weight: '100 900', style: 'italic' },
  ],
  newsreader: [
    { src: newsreader, weight: '200 800' },
    { src: newsreaderItalic, weight: '200 800', style: 'italic' },
  ],
  'plex-sans': [
    { src: plexSans, weight: '100 700', stretch: '75% 100%' },
    { src: plexSansItalic, weight: '100 700', stretch: '75% 100%', style: 'italic' },
  ],
  'plex-mono': [
    { src: plexMono400, weight: '400' },
    { src: plexMono600, weight: '600' },
    { src: plexMono400i, weight: '400', style: 'italic' },
  ],
  'jetbrains-mono': [{ src: jetbrainsMono, weight: '100 800' }],
  'dm-sans': [
    { src: dmSans, weight: '100 1000' },
    { src: dmSansItalic, weight: '100 1000', style: 'italic' },
  ],
  'dm-mono': [
    { src: dmMono400, weight: '400' },
    { src: dmMono500, weight: '500' },
  ],
  inter: [
    { src: inter, weight: '100 900' },
    { src: interItalic, weight: '100 900', style: 'italic' },
  ],
  'inter-tight': [{ src: interTight, weight: '100 900' }],
  bricolage: [{ src: bricolage, weight: '200 800', stretch: '75% 100%' }],
  'space-mono': [
    { src: spaceMono400, weight: '400' },
    { src: spaceMono700, weight: '700' },
  ],
  jost: [
    { src: jost, weight: '100 900' },
    { src: jostItalic, weight: '100 900', style: 'italic' },
  ],
  michroma: [{ src: michroma, weight: '400' }],
  'red-hat-mono': [{ src: redHatMono, weight: '300 700' }],
  unbounded: [{ src: unbounded, weight: '200 900' }],
  sora: [{ src: sora, weight: '100 800' }],
  geist: [
    { src: geist, weight: '100 900' },
    { src: geistItalic, weight: '100 900', style: 'italic' },
  ],
  'geist-mono': [{ src: geistMono, weight: '100 900' }],
};
