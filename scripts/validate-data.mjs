#!/usr/bin/env node
/** Schema and duplicate checks for data/libraries.json. Runs as part of `npm run build`. */
import { readFile } from 'node:fs/promises';
import { REPO_HOSTS } from '../src/lib/repo.ts';

const root = new URL('../', import.meta.url);
const libs = JSON.parse(await readFile(new URL('data/libraries.json', root), 'utf8'));
const cats = new Set(JSON.parse(await readFile(new URL('data/categories.json', root), 'utf8')).map((c) => c.id));

const errors = [];
const seen = new Map();
libs.forEach((l, i) => {
  const at = `#${i} (${l.repo ?? l.name ?? '?'})`;
  for (const k of ['name', 'repo', 'language', 'category', 'description']) {
    if (typeof l[k] !== 'string' || !l[k].trim()) errors.push(`${at}: missing "${k}"`);
  }
  if (l.repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(l.repo)) errors.push(`${at}: repo must be "owner/name"`);
  if (l.host !== undefined && !(l.host in REPO_HOSTS)) errors.push(`${at}: unknown host "${l.host}" (allowed: ${Object.keys(REPO_HOSTS).join(', ')}; omit for GitHub)`);
  if (l.host === 'github') errors.push(`${at}: omit "host" for GitHub repositories`);
  if (l.category && !cats.has(l.category)) errors.push(`${at}: unknown category "${l.category}"`);
  if (l.description && !/[.)]$/.test(l.description)) errors.push(`${at}: description should end with a period`);
  if (l.description && l.description.length > 160) errors.push(`${at}: description longer than 160 chars`);
  const key = l.repo?.toLowerCase();
  if (key && seen.has(key)) errors.push(`${at}: duplicate of #${seen.get(key)}`);
  seen.set(key, i);
  if (!l.verifiedAt) errors.push(`${at}: not verified yet; run \`npm run verify\``);
});

// Starter picks must point at catalog entries that aren't archived.
const picks = JSON.parse(await readFile(new URL('data/picks.json', root), 'utf8'));
const byRepo = new Map(libs.map((l) => [l.repo.toLowerCase(), l]));
for (const group of picks) {
  for (const p of group.picks) {
    const lib = byRepo.get(p.repo.toLowerCase());
    if (!lib) errors.push(`picks.json: ${p.repo} is not in libraries.json`);
    else if (lib.archived) errors.push(`picks.json: ${p.repo} is archived; pick something maintained`);
    if (!p.task || !p.why || !/[.]$/.test(p.why)) errors.push(`picks.json: ${p.repo} needs a task and a one-sentence "why" ending with a period`);
  }
}

if (errors.length) {
  console.error(`data/libraries.json has ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`data/libraries.json OK (${libs.length} entries, ${cats.size} categories)`);
