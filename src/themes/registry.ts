/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE THEME REGISTRY. The one file to edit to add, remove or reorder themes.
 *
 *  - The order here is the order in the picker. A first visit gets a random theme that has
 *    the visitor's light or dark mode, and keeps it (src/themes/choose.ts). The FIRST theme is
 *    the default: what shows without JavaScript, and the colors of the social cards.
 *  - To ship a subset, delete lines from THEMES (and their imports). Fonts, CSS, the
 *    picker, the /design/ page and the contrast tests all follow this list.
 *  - With a single theme the picker hides itself. If that theme has both a light and a
 *    dark palette, the header shows a plain light/dark switch instead.
 *  Details in docs/THEMES.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Theme } from './types.ts';
import fieldGuide from './field-guide.ts';
import rhythm from './rhythm.ts';
import alloy from './alloy.ts';
import score from './score.ts';
import phosphor from './phosphor.ts';
import pianoRoll from './piano-roll.ts';
import blueprint from './blueprint.ts';
import swiss from './swiss.ts';
import riso from './riso.ts';
import analog from './analog.ts';
import afterHours from './after-hours.ts';
import graphite from './graphite.ts';

export const THEMES: Theme[] = [
  fieldGuide,
  rhythm,
  alloy,
  score,
  phosphor,
  pianoRoll,
  blueprint,
  swiss,
  riso,
  analog,
  afterHours,
  graphite,
];

export const DEFAULT_THEME: Theme = THEMES[0];
