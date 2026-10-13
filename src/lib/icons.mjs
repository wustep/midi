/**
 * The MIDI Field Guide icon set. One source for every icon on the site, the brand mark, the favicons
 * (scripts/make-icons.mjs) and the social cards (src/lib/og-card.ts). Shown at /design/#icons.
 *
 * Grid and drawing rules (docs/DESIGN.md, "Icons"):
 *   - 24 × 24 viewBox with a 2px safe area: geometry stays within 2–22 on both axes.
 *   - One 2px stroke, round caps and round joins, no fills, except the "solid" glyphs (play, pause,
 *     stop, star), which are the same outline filled so their corners stay round.
 *   - Rectangles take a 2px corner radius; circles are drawn as circles, not paths.
 *   - Keylines: a full circle is r 9 (search lens r 6.5), a full square is 16, a tall shape is 14 × 18.
 *   - Optical centre: arrows and chevrons sit on the 12px centre lines; play is nudged +1px right.
 * Plain JavaScript so the build scripts can import it on any Node version.
 */

/** @typedef {{ body: string; solid?: boolean }} IconDef */

/** @type {Record<string, IconDef>} */
export const ICONS = {
  search: { body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>' },
  menu: { body: '<path d="M4 7h16M4 12h16M4 17h16"/>' },
  close: { body: '<path d="M6 6l12 12M18 6 6 18"/>' },
  sun: { body: '<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>' },
  moon: { body: '<path d="M20 14.6A8 8 0 1 1 9.4 4a6.5 6.5 0 0 0 10.6 10.6Z"/>' },
  code: { body: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/>' },
  upload: { body: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>' },
  play: { body: '<path d="M8 5v14l11-7Z"/>', solid: true },
  pause: { body: '<rect x="6.5" y="5" width="3" height="14" rx="1"/><rect x="14.5" y="5" width="3" height="14" rx="1"/>', solid: true },
  stop: { body: '<rect x="6" y="6" width="12" height="12" rx="2"/>', solid: true },
  star: { body: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z"/>', solid: true },
  'chevron-down': { body: '<path d="m6 9 6 6 6-6"/>' },
  'chevron-right': { body: '<path d="m9 6 6 6-6 6"/>' },
  'arrow-right': { body: '<path d="M4 12h16M14 6l6 6-6 6"/>' },
  'arrow-up-right': { body: '<path d="M7 17 17 7M8 7h9v9"/>' },
  check: { body: '<path d="m4.5 12.5 5 5 10-11"/>' },
  copy: { body: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>' },
  plug: { body: '<path d="M9 3v4M15 3v4M6 7h12v3a6 6 0 0 1-12 0Z M12 16v5"/>' },
  send: { body: '<path d="M3 12h12M11 7l5 5-5 5M20 4v16"/>' },
  /** A knob seen from above: the skirt, the cap, and the pointer line. The theme picker. */
  knob: { body: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 7V3"/>' },
  file: { body: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>' },
  /** The DIN-5 MIDI socket: ring, key notch at the top, five pins on the lower half-circle (pin 2 marked). */
  din: {
    body:
      '<circle cx="12" cy="12" r="9"/>' +
      '<rect x="10.5" y="2" width="3" height="3.5" rx="1" fill="currentColor" stroke="none"/>' +
      '<g fill="currentColor" stroke="none"><circle cx="6.5" cy="12" r="1.5"/><circle cx="17.5" cy="12" r="1.5"/><circle cx="8.1" cy="15.9" r="1.5"/><circle cx="15.9" cy="15.9" r="1.5"/></g>' +
      '<circle class="pin2" cx="12" cy="17.5" r="1.5" fill="var(--pin, currentColor)" stroke="none"/>',
  },
};

/** @typedef {keyof typeof ICONS} IconName */

/**
 * SVG markup for an icon. Decorative by default (aria-hidden); pass `label` to make it an image with a name.
 * @param {string} name
 * @param {{ size?: number; label?: string; class?: string }} [opts]
 */
export function iconSvg(name, { size = 20, label, class: cls = '' } = {}) {
  const def = ICONS[name];
  if (!def) throw new Error(`Unknown icon "${name}"`);
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true" focusable="false"';
  const paint = def.solid ? 'fill="currentColor" stroke="currentColor"' : 'fill="none" stroke="currentColor"';
  return `<svg class="icon icon-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" ${paint} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${def.body}</svg>`;
}

/**
 * A standalone SVG document for an icon in a given color, for CSS (data URIs, masks) and image rendering.
 * @param {string} name
 * @param {string} [color]
 */
export function iconDocument(name, color = '#000') {
  const def = ICONS[name];
  const paint = def.solid ? `fill="${color}" stroke="${color}"` : `fill="none" stroke="${color}"`;
  const body = def.body.replace(/var\(--pin, currentColor\)/g, color).replace(/currentColor/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${paint} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
