#!/usr/bin/env node
/**
 * Verifies every entry in data/libraries.json against its forge's API and writes the results back
 * into the data file: GitHub through the `gh` CLI, Codeberg (entries with "host": "codeberg") through
 * its public Forgejo API.
 *
 *   - 404 (repo does not exist / is private)  -> entry removed
 *   - renamed / transferred repo              -> `repo` updated to the canonical owner/name
 *   - archived                                -> `archived: true` (kept, flagged in the UI)
 *   - stars, license (SPDX id), pushedAt      -> refreshed
 *
 * Any other failure (rate limit, network, auth) aborts without touching the file.
 *
 * Usage: node scripts/verify-links.mjs [--dry-run] [--concurrency=8]
 */
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const DATA = new URL('../data/libraries.json', import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const concurrency = Number(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 8);

/** Codeberg runs Forgejo; map its repo JSON onto the GitHub fields used below. */
async function fetchCodeberg(repo) {
  const api = `https://codeberg.org/api/v1/repos/${repo}`;
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) return { ok: false, notFound: true };
    if (!res.ok) return { ok: false, error: `Codeberg API HTTP ${res.status}` };
    const d = await res.json();
    // Forgejo's updated_at moves on any change; the newest commit on the default branch is the real "last push".
    const commits = await fetch(`${api}/commits?sha=${d.default_branch}&limit=1&stat=false&verification=false&files=false`, {
      signal: AbortSignal.timeout(20_000),
    }).then((r) => (r.ok ? r.json() : []));
    return {
      ok: true,
      data: {
        full_name: d.full_name,
        private: d.private,
        archived: d.archived,
        stargazers_count: d.stars_count,
        pushed_at: commits[0]?.commit?.committer?.date ?? d.updated_at,
        homepage: d.website,
        license: undefined, // Forgejo doesn't report an SPDX id here; keep the curated one.
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchRepo(repo, host) {
  if (host === 'codeberg') return fetchCodeberg(repo);
  try {
    const { stdout } = await run('gh', ['api', `repos/${repo}`], { maxBuffer: 10 * 1024 * 1024 });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (/HTTP 404|Not Found/i.test(text)) return { ok: false, notFound: true };
    return { ok: false, error: text.trim() || String(err) };
  }
}

async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

function normalizeLicense(license) {
  if (!license) return null;
  if (!license.spdx_id || license.spdx_id === 'NOASSERTION') return 'Other';
  return license.spdx_id;
}

const entries = JSON.parse(await readFile(DATA, 'utf8'));
console.log(`Verifying ${entries.length} repositories with concurrency ${concurrency}…`);

let done = 0;
const results = await pool(entries, concurrency, async (entry) => {
  const res = await fetchRepo(entry.repo, entry.host);
  done++;
  if (done % 25 === 0) console.log(`  ${done}/${entries.length}`);
  return res;
});

const removed = [];
const renamed = [];
const archived = [];
const errors = [];
const kept = [];
const today = new Date().toISOString().slice(0, 10);

entries.forEach((entry, i) => {
  const res = results[i];
  if (res.notFound) return removed.push(entry.repo);
  if (!res.ok) return errors.push(`${entry.repo}: ${res.error}`);
  const d = res.data;
  if (d.private) return removed.push(`${entry.repo} (private)`);
  if (d.full_name !== entry.repo) renamed.push(`${entry.repo} -> ${d.full_name}`);
  if (d.archived) archived.push(d.full_name);
  kept.push({
    name: entry.name,
    repo: d.full_name,
    ...(entry.host ? { host: entry.host } : {}),
    language: entry.language,
    category: entry.category,
    description: entry.description,
    license: d.license === undefined ? entry.license : normalizeLicense(d.license),
    stars: d.stargazers_count,
    pushedAt: d.pushed_at ? new Date(d.pushed_at).toISOString().slice(0, 10) : null,
    archived: Boolean(d.archived),
    ...(d.homepage ? { homepage: d.homepage } : {}),
    verifiedAt: today,
  });
});

if (errors.length) {
  console.error(`\n${errors.length} request(s) failed for reasons other than 404; data file left untouched:`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

// Collapse duplicates that only became visible after following renames.
const seen = new Set();
const deduped = kept.filter((e) => {
  const key = e.repo.toLowerCase();
  if (seen.has(key)) {
    removed.push(`${e.repo} (duplicate)`);
    return false;
  }
  seen.add(key);
  return true;
});

for (const r of renamed) console.log(`  ↪ renamed  ${r}`);
for (const a of archived) console.log(`  ▣ archived ${a}`);
for (const r of removed) console.log(`  ✗ removed  ${r}`);
console.log(
  `\n${deduped.length} verified · ${archived.length} archived · ${renamed.length} renamed · ${removed.length} removed`,
);

if (dryRun) {
  console.log('(dry run: data file not written)');
} else {
  await writeFile(DATA, JSON.stringify(deduped, null, 2) + '\n');
  console.log(`Wrote ${new URL(DATA).pathname}`);
}
