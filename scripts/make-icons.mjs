#!/usr/bin/env node
/**
 * Generates the favicons, Apple touch icon and web-app manifest icons from the brand mark in
 * src/lib/icons.mjs ("din"), so they always match the header logo. Run after changing the mark:
 *
 *   node scripts/make-icons.mjs
 *
 * Writes public/favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192.png,
 * icon-512.png, icon-maskable-512.png and site.webmanifest.
 */
import { writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const INK = '#1a1915';
const PAPER = '#f2efe6';
const EMBER = '#ff8a4c'; // the dark-theme accent: on an ink tile it reads the way the light accent does on paper

/**
 * The DIN mark on the 24 grid, drawn in paper on an ink tile. `weight` thickens strokes and pins for
 * tiny sizes, where a 2px line scaled into a 16px tile would fall below one device pixel.
 */
function mark({ weight = 1 } = {}) {
  const sw = 2 * weight;
  const pr = 1.5 * Math.min(weight, 1.25);
  // Pins sit on a half-circle of radius 5.5; a heavier ring pulls them inward so they keep clear of it.
  const R = 5.5 - (weight - 1) * 1.7;
  const at = (deg) => [12 + R * Math.cos((deg * Math.PI) / 180), 12 + R * Math.sin((deg * Math.PI) / 180)];
  const pins = [at(180), at(0), at(135), at(45)];
  const [bx, by] = at(90);
  return (
    `<circle cx="12" cy="12" r="9" fill="none" stroke="${PAPER}" stroke-width="${sw}"/>` +
    `<rect x="${12 - 1.5 * Math.min(weight, 1.2)}" y="${3 - sw / 2}" width="${3 * Math.min(weight, 1.2)}" height="${2.5 + sw / 2}" rx="1" fill="${PAPER}"/>` +
    pins.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${pr}" fill="${PAPER}"/>`).join('') +
    `<circle cx="${bx}" cy="${by}" r="${pr}" fill="${EMBER}"/>`
  );
}

/** A 24-unit tile: rounded square (or full bleed) with the mark scaled into it. */
function tile({ size, radius = 5.5, scale = 0.74, weight = 1, bleed = false }) {
  const off = 12 - 12 * scale;
  const bg = bleed ? `<rect width="24" height="24" fill="${INK}"/>` : `<rect width="24" height="24" rx="${radius}" fill="${INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${bg}<g transform="translate(${off} ${off}) scale(${scale})">${mark({ weight })}</g></svg>`;
}

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

/** ICO with PNG-compressed entries (supported by every current browser and Windows since Vista). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}

const out = (f) => new URL(`../public/${f}`, import.meta.url);

// Browser tabs: a heavier mark so the ring and pins survive at 16px.
const favSvg = tile({ size: 32, scale: 0.8, weight: 1.45 });
await writeFile(out('favicon.svg'), favSvg + '\n');
await writeFile(out('favicon.ico'), ico([16, 32, 48].map((size) => ({ size, data: png(tile({ size, scale: 0.8, weight: size <= 16 ? 1.6 : 1.45 }), size) }))));

// iOS rounds the corners itself, so the touch icon is full bleed.
await writeFile(out('apple-touch-icon.png'), png(tile({ size: 180, bleed: true, scale: 0.64, weight: 1.15 }), 180));
await writeFile(out('icon-192.png'), png(tile({ size: 192, scale: 0.72, weight: 1.15 }), 192));
await writeFile(out('icon-512.png'), png(tile({ size: 512, scale: 0.72 }), 512));
// Maskable: the mark stays inside the central 80% safe zone whatever shape the platform cuts.
await writeFile(out('icon-maskable-512.png'), png(tile({ size: 512, bleed: true, scale: 0.56 }), 512));

const manifest = {
  name: 'MIDI Field Guide',
  short_name: 'MIDI Guide',
  description: 'The field guide to MIDI: protocol docs, interactive tools, and a curated catalog of open-source MIDI libraries.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: PAPER,
  theme_color: PAPER,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
await writeFile(out('site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png, site.webmanifest');
