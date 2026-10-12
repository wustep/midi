#!/usr/bin/env node
/**
 * Checks every URL in data/resources.json (redirects followed, browser user agent).
 * Fails (exit 1) on anything other than HTTP 200. A 403/429 from hosts known to block bots
 * is reported as a warning, because those hosts serve the page fine in a real browser.
 *
 * Usage: node scripts/verify-resources.mjs
 */
import { readFile } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BOT_BLOCKING_HOSTS = ['www.w3.org', 'www.usb.org', 'developer.apple.com', 'www.alsa-project.org', 'colinraffel.com'];

const resources = JSON.parse(await readFile(new URL('../data/resources.json', import.meta.url), 'utf8'));

/** fetch() with manual redirects and a cookie jar (some hosts redirect-loop until a cookie is set). */
async function get(url) {
  const cookies = new Map();
  for (let hops = 0; hops < 10; hops++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    await res.body?.cancel();
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).href;
      continue;
    }
    return { status: res.status, finalUrl: url };
  }
  throw new Error('too many redirects');
}

async function check(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await get(url);
      if (res.status === 200 || attempt === 2) return res;
    } catch (err) {
      if (attempt === 2) return { status: 0, error: err.cause?.code ?? err.message };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// Small worker pool: some hosts drop connections under parallel load.
const results = new Array(resources.length);
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < resources.length) {
      const i = next++;
      results[i] = { r: resources[i], ...(await check(resources[i].url)) };
    }
  }),
);
let failures = 0;
let warnings = 0;
for (const { r, status, finalUrl, error } of results) {
  const host = new URL(r.url).host;
  if (status === 200) {
    const moved = finalUrl && finalUrl.replace(/\/$/, '') !== r.url.replace(/\/$/, '') ? ` (redirects to ${finalUrl})` : '';
    console.log(`  ✓ 200 ${r.url}${moved}`);
  } else if ((status === 403 || status === 429) && BOT_BLOCKING_HOSTS.includes(host)) {
    warnings++;
    console.warn(`  ! ${status} ${r.url} (host blocks automated requests; check manually)`);
  } else {
    failures++;
    console.error(`  ✗ ${status || 'ERR'} ${r.url}${error ? ` ${error}` : ''}`);
  }
}
console.log(`\n${resources.length} resources · ${failures} failed · ${warnings} warnings`);
process.exit(failures ? 1 : 0);
