#!/usr/bin/env node
/**
 * Crawls the built site in dist/ and checks that every internal link, asset, and #fragment resolves.
 * Runs after `astro build`. Exits 1 on any broken link.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const exists = async (p) => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

/** Map a URL path to a file in dist/, or null. */
async function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = [join(DIST, clean), join(DIST, clean, 'index.html'), join(DIST, `${clean.replace(/\/$/, '')}.html`)];
  for (const c of candidates) if (await exists(c)) return c;
  return null;
}

const files = await walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const idCache = new Map();
async function idsOf(file) {
  if (!idCache.has(file)) {
    const html = await readFile(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\s(?:id|name)=["']([^"']+)["']/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}

const broken = [];
let checked = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const pagePath = '/' + relative(DIST, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  // Strip <script> and <pre>/<code> content so code samples aren't treated as links.
  const scanned = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<pre[\s\S]*?<\/pre>/gi, '');
  for (const m of scanned.matchAll(/\s(href|src)=["']([^"']+)["']/g)) {
    const raw = m[2];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw) || raw.startsWith('//')) continue;
    checked++;
    const url = new URL(raw, `https://x${pagePath}`);
    const target = url.pathname === pagePath && raw.startsWith('#') ? file : await resolveFile(url.pathname);
    if (!target) {
      broken.push(`${pagePath}: ${raw} (no such page/file)`);
      continue;
    }
    if (url.hash && url.hash.length > 1 && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!(await idsOf(target)).has(id)) broken.push(`${pagePath}: ${raw} (missing #${id})`);
    }
  }
}

if (broken.length) {
  console.error(`✗ ${broken.length} broken internal link(s) in dist/:`);
  for (const b of [...new Set(broken)]) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`✓ ${checked} internal links across ${htmlFiles.length} pages resolve`);
