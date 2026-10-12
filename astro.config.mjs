// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://midi.community',
  trailingSlash: 'ignore',
  // Keep source whitespace so inline links/code after a line break keep their leading space.
  compressHTML: false,
  build: { format: 'directory' },
});
