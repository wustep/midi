#!/usr/bin/env node
/**
 * Checks every URL in data/resources.json, data/community.json and data/midi-files.json
 * (including the optional "source" and "paper" fields), plus a shape check of each entry.
 *
 * - Redirects are followed manually with a browser user agent and a cookie jar.
 * - Final 200 passes. A final 3xx without Location, or a 401 reached through a redirect
 *   (a login wall), is a warning.
 * - 403/429/503 from hosts in BOT_BLOCKING_HOSTS is a warning: those hosts serve the page fine in a
 *   real browser but challenge automated requests.
 * - Discord invites are checked through Discord's public invite API rather than the HTML page.
 * - Anything else fails (exit 1), as does any shape error.
 *
 * Usage: node scripts/verify-resources.mjs
 */
import { readFile } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Hosts that answer automated requests with 403/429/503 challenges but work in a browser. */
const BOT_BLOCKING_HOSTS = [
  'www.w3.org',
  'www.usb.org',
  'developer.apple.com',
  'www.alsa-project.org',
  'colinraffel.com',
  'www.kvraudio.com', // Cloudflare challenge
  'gearspace.com', // Cloudflare challenge
  'stackoverflow.com', // Cloudflare challenge
  'music.stackexchange.com', // Cloudflare challenge
  'www.reddit.com', // "Prove your humanity" / 403 for non-browser clients
  'mixxx.discourse.group', // "Checking your browser" challenge for scripted requests
];

/** Hosts that are reachable but routinely take longer than the default timeout to respond. */
const SLOW_HOSTS = ['www.alsa-project.org', 'zenodo.org'];

const FILES = {
  'resources.json': {
    groups: [
      'Official specifications',
      'Standards bodies',
      'RFCs and web standards',
      'Platform documentation',
      'Learning and references',
    ],
    required: ['group', 'title', 'url', 'description'],
  },
  'community.json': {
    groups: ['Forums', 'Reddit', 'Discord', 'Mailing lists', 'Other communities'],
    required: ['group', 'title', 'url', 'description'],
    tags: ['beginner-friendly', 'developers', 'hardware', 'DAW', 'live-coding', 'modular', 'Linux', 'plugins', 'theory', 'general'],
  },
  'midi-files.json': {
    groups: ['Public-domain & free archives', 'Datasets', 'Other sources'],
    required: ['group', 'title', 'url', 'description', 'license', 'licenseNote', 'commercialUse'],
    enums: { commercialUse: ['yes', 'no', 'varies', 'unclear'] },
  },
};
const URL_FIELDS = ['url', 'source', 'paper'];

// ---------- shape check ----------
const shapeErrors = [];
const data = {};
for (const [file, spec] of Object.entries(FILES)) {
  let entries;
  try {
    entries = JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
  } catch (err) {
    shapeErrors.push(`${file}: cannot read/parse (${err.message})`);
    continue;
  }
  if (!Array.isArray(entries)) {
    shapeErrors.push(`${file}: top level must be an array`);
    continue;
  }
  data[file] = entries;
  const seen = new Set();
  entries.forEach((e, i) => {
    const where = `${file}[${i}] ${e?.title ?? ''}`.trim();
    for (const f of spec.required) {
      if (typeof e[f] !== 'string' || !e[f].trim()) shapeErrors.push(`${where}: missing "${f}"`);
    }
    if (e.group && !spec.groups.includes(e.group)) shapeErrors.push(`${where}: unknown group "${e.group}"`);
    for (const [f, allowed] of Object.entries(spec.enums ?? {})) {
      if (e[f] !== undefined && !allowed.includes(e[f])) shapeErrors.push(`${where}: "${f}" must be one of ${allowed.join(', ')}`);
    }
    if (typeof e.description === 'string' && !/[.!?]$/.test(e.description.trim())) {
      shapeErrors.push(`${where}: description should end with a period`);
    }
    for (const f of URL_FIELDS) {
      if (e[f] === undefined) continue;
      try {
        const u = new URL(e[f]);
        if (!/^https?:$/.test(u.protocol)) throw new Error('not http(s)');
      } catch {
        shapeErrors.push(`${where}: "${f}" is not a valid http(s) URL`);
      }
    }
    if (file === 'community.json' && e.group === 'Discord' && !e.source) {
      shapeErrors.push(`${where}: Discord entries need a "source" (official page with the invite)`);
    }
    if (spec.tags) {
      if (!Array.isArray(e.tags) || e.tags.length === 0) {
        shapeErrors.push(`${where}: "tags" must be a non-empty array`);
      } else {
        for (const t of e.tags) {
          if (!spec.tags.includes(t)) shapeErrors.push(`${where}: unknown tag "${t}" (allowed: ${spec.tags.join(', ')})`);
        }
        if (new Set(e.tags).size !== e.tags.length) shapeErrors.push(`${where}: duplicate tags`);
      }
    }
    if (e.url) {
      if (seen.has(e.url)) shapeErrors.push(`${where}: duplicate url ${e.url}`);
      seen.add(e.url);
    }
  });
}

// ---------- URL checks ----------
/** fetch() with manual redirects and a cookie jar (some hosts redirect-loop until a cookie is set). */
async function get(url) {
  const cookies = new Map();
  let redirected = false;
  for (let hops = 0; hops < 10; hops++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      signal: AbortSignal.timeout(SLOW_HOSTS.includes(new URL(url).host) ? 60_000 : 20_000),
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
      redirected = true;
      continue;
    }
    return { status: res.status, finalUrl: url, redirected };
  }
  throw new Error('too many redirects');
}

const DISCORD_INVITE = /^https?:\/\/(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]+)\/?$/;

async function getDiscord(code) {
  for (let tries = 0; ; tries++) {
    const res = await fetch(`https://discord.com/api/v9/invites/${code}`, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    // The invite API rate-limits bursts; wait as long as it asks (capped) and try again.
    if (res.status === 429 && tries < 3) {
      const wait = Math.min(Number(body?.retry_after ?? res.headers.get('retry-after') ?? 2), 30);
      await new Promise((r) => setTimeout(r, wait * 1000 + 250));
      continue;
    }
    return { status: res.status, guild: body?.guild?.name };
  }
}

async function check(url) {
  const discord = url.match(DISCORD_INVITE);
  const attempts = SLOW_HOSTS.includes(new URL(url).host) ? 3 : 2;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = discord ? await getDiscord(discord[1]) : await get(url);
      if (res.status === 200 || attempt === attempts) return res;
    } catch (err) {
      if (attempt === attempts) return { status: 0, error: err.cause?.code ?? err.message };
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

const jobs = [];
for (const [file, entries] of Object.entries(data)) {
  for (const e of entries) {
    for (const field of URL_FIELDS) {
      if (typeof e[field] === 'string') jobs.push({ file, field, title: e.title, url: e[field] });
    }
  }
}

// Small worker pool: some hosts drop connections under parallel load.
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      Object.assign(job, await check(job.url));
    }
  }),
);

const summary = {};
let failures = 0;
let warnings = 0;
for (const file of Object.keys(data)) {
  console.log(`\n${file}`);
  const s = (summary[file] = { urls: 0, ok: 0, warn: 0, fail: 0 });
  for (const j of jobs.filter((x) => x.file === file)) {
    s.urls++;
    const host = new URL(j.url).host;
    const label = j.field === 'url' ? '' : ` [${j.field}]`;
    const moved =
      j.finalUrl && j.finalUrl.replace(/\/$/, '') !== j.url.replace(/\/$/, '') ? ` (redirects to ${j.finalUrl})` : '';
    if (j.status === 200) {
      s.ok++;
      console.log(`  ✓ 200 ${j.url}${label}${j.guild ? ` (Discord: ${j.guild})` : moved}`);
    } else if ([403, 429, 503].includes(j.status) && BOT_BLOCKING_HOSTS.includes(host)) {
      s.warn++;
      console.warn(`  ! ${j.status} ${j.url}${label} (host blocks automated requests; check manually)`);
    } else if (j.status >= 300 && j.status < 400) {
      s.warn++;
      console.warn(`  ! ${j.status} ${j.url}${label} (redirect without Location${moved}; check manually)`);
    } else if (j.status === 401 && j.redirected) {
      s.warn++;
      console.warn(`  ! 401 ${j.url}${label} (redirects to a login wall${moved}; check manually)`);
    } else {
      s.fail++;
      console.error(`  ✗ ${j.status || 'ERR'} ${j.url}${label}${j.error ? ` ${j.error}` : ''}${moved}`);
    }
  }
  failures += s.fail;
  warnings += s.warn;
}

console.log('\nSummary');
for (const [file, s] of Object.entries(summary)) {
  console.log(`  ${file.padEnd(16)} ${data[file].length} entries · ${s.urls} URLs · ${s.ok} ok · ${s.warn} warnings · ${s.fail} failed`);
}
if (shapeErrors.length) {
  console.error(`\nShape errors (${shapeErrors.length}):`);
  for (const e of shapeErrors) console.error(`  ✗ ${e}`);
}
console.log(`\n${jobs.length} URLs · ${failures} failed · ${warnings} warnings · ${shapeErrors.length} shape errors`);
process.exit(failures || shapeErrors.length ? 1 : 0);
