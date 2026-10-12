// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://midi.community',
  trailingSlash: 'ignore',
  // Keep source whitespace so inline links/code after a line break keep their leading space.
  compressHTML: false,
  build: { format: 'directory' },
  // The Web MIDI monitor moved under /tools/ in round 7.
  redirects: { '/try': '/tools/monitor/' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
