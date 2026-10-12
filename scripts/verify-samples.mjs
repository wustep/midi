#!/usr/bin/env node
/**
 * Verifies the Samples section data:
 *  1. Every URL in data/sample-sources.json (url, licenseUrl) and data/samples.json (sourceUrl, licenseUrl)
 *     answers 200 (redirects followed, browser user agent). A 403/429 from hosts known to block bots is a warning.
 *  2. Every data/samples.json entry has its audio files on disk under public/sounds/<id>/<note>.mp3,
 *     their total size matches `bytes`, a LICENSE.txt is present, and the license is redistributable.
 *     Looped instruments (loop: true) need encoderDelay plus loops/pcmSamples for every note, with
 *     0 ≤ start < end ≤ duration, and pcmSamples must match the PCM length recorded in each MP3's LAME tag.
 * Exits 1 on any failure.
 *
 * Usage: node scripts/verify-samples.mjs [--offline]   (--offline skips the network checks)
 */
import { readFile, stat } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BOT_BLOCKING_HOSTS = ['sourceforge.net', 'packages.debian.org', 'freesound.org', 'www.pianobook.co.uk'];
/** Licenses that allow us to redistribute (self-host) modified sample files. No NC / ND / custom terms. */
const REDISTRIBUTABLE = /^(CC0-1\.0|CC-BY-(3\.0|4\.0)|CC-BY-SA-(3\.0|4\.0)|MIT|Unlicense|Public Domain)$/;

const root = new URL('../', import.meta.url);
const sources = JSON.parse(await readFile(new URL('data/sample-sources.json', root), 'utf8'));
const samples = JSON.parse(await readFile(new URL('data/samples.json', root), 'utf8'));
const offline = process.argv.includes('--offline');

let failures = 0;
let warnings = 0;
const fail = (msg) => (failures++, console.error(`  ✗ ${msg}`));
const warn = (msg) => (warnings++, console.warn(`  ! ${msg}`));

/* ---------- 1. data shape ---------- */
console.log('Checking data/sample-sources.json shape…');
const GROUPS = ['SoundFonts (SF2/SF3)', 'SFZ libraries', 'Multisampled instruments', 'Drum kits', 'Collections & directories'];
const titles = new Set();
for (const s of sources) {
  const where = `sample-sources "${s.title}"`;
  if (!GROUPS.includes(s.group)) fail(`${where}: unknown group "${s.group}"`);
  for (const k of ['title', 'url', 'description', 'license', 'licenseNote']) if (!s[k]) fail(`${where}: missing ${k}`);
  if (!Array.isArray(s.formats) || !s.formats.length) fail(`${where}: formats must be a non-empty array`);
  if (s.description && !s.description.endsWith('.')) fail(`${where}: description should end with a period`);
  if (titles.has(s.title)) fail(`${where}: duplicate title`);
  titles.add(s.title);
}

/**
 * Reads the Xing/Info + LAME tag of an MP3: frame count, encoder delay and end padding (in samples).
 * Returns null when the file has no such tag.
 */
function lameTag(buf) {
  let p = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') p = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  const head = buf.subarray(p, p + 64).toString('latin1');
  const at = Math.max(head.indexOf('Xing'), head.indexOf('Info'));
  if (at < 0) return null;
  const x = p + at;
  const flags = buf.readUInt32BE(x + 4);
  if (!(flags & 1)) return null;
  const frames = buf.readUInt32BE(x + 8);
  let o = x + 12;
  if (flags & 2) o += 4;
  if (flags & 4) o += 100;
  if (flags & 8) o += 4;
  if (o + 24 > buf.length) return null;
  const delay = (buf[o + 21] << 4) | (buf[o + 22] >> 4);
  const padding = ((buf[o + 22] & 15) << 8) | buf[o + 23];
  return { frames, delay, padding, samples: frames * 1152 - delay - padding };
}

/** Loop fields of one note: 0 ≤ start < end ≤ duration, and pcmSamples consistent with the MP3's LAME tag. */
function checkLoop(where, e, n, buf) {
  const pcm = e.pcmSamples[n];
  const { start, end } = e.loops[n];
  if (!Number.isInteger(pcm) || pcm <= 0) return fail(`${where}: pcmSamples["${n}"] must be a positive integer`);
  const duration = pcm / 44100;
  if (typeof start !== 'number' || typeof end !== 'number' || !(start >= 0 && start < end && end <= duration))
    return fail(`${where}: loops["${n}"] must satisfy 0 ≤ start < end ≤ duration (${duration.toFixed(3)} s); got ${start}–${end}`);
  if (end - start < 0.5) warn(`${where}: loops["${n}"] is shorter than 0.5 s (${(end - start).toFixed(3)} s)`);
  const tag = lameTag(buf);
  if (!tag) return warn(`${where}: ${n}.mp3 has no LAME/Info tag; cannot cross-check pcmSamples`);
  if (tag.samples !== pcm) fail(`${where}: ${n}.mp3 LAME tag says ${tag.samples} PCM samples but pcmSamples["${n}"] is ${pcm}`);
  // The tag's delay excludes the 529-sample MP3 decoder delay, which encoderDelay includes.
  if (Number.isInteger(e.encoderDelay) && tag.delay + 529 !== e.encoderDelay)
    warn(`${where}: ${n}.mp3 LAME tag delay ${tag.delay} + 529 ≠ encoderDelay ${e.encoderDelay}`);
}

/* ---------- 2. self-hosted instruments ---------- */
console.log('Checking data/samples.json and public/sounds/…');
const ids = new Set();
let totalBytes = 0;
for (const e of samples) {
  const where = `samples "${e.id}"`;
  if (ids.has(e.id)) fail(`${where}: duplicate id`);
  ids.add(e.id);
  for (const k of ['id', 'name', 'family', 'source', 'sourceUrl', 'license', 'licenseUrl', 'attribution']) if (!e[k]) fail(`${where}: missing ${k}`);
  if (!REDISTRIBUTABLE.test(e.license)) fail(`${where}: license "${e.license}" is not in the redistributable allowlist`);
  if (!Array.isArray(e.notes) || !e.notes.length) fail(`${where}: notes must be a non-empty array`);
  else if (e.notes.some((n, i) => !Number.isInteger(n) || n < 0 || n > 127 || (i && n <= e.notes[i - 1])))
    fail(`${where}: notes must be ascending MIDI note numbers 0–127`);
  if (e.drumMap) {
    const keys = Object.keys(e.drumMap).map(Number).sort((a, b) => a - b);
    if (keys.join() !== e.notes.join()) fail(`${where}: drumMap keys must match notes`);
  } else if (!Array.isArray(e.range) || e.range[0] > e.notes[0] || e.range[1] < e.notes.at(-1)) {
    fail(`${where}: range must cover all sampled notes`);
  } else if (e.notes[0] - e.range[0] > 7 || e.range[1] - e.notes.at(-1) > 7) {
    warn(`${where}: range extends more than 7 semitones beyond the outermost samples`);
  }
  if (typeof e.release !== 'number' || typeof e.sustain !== 'boolean' || typeof e.loop !== 'boolean')
    fail(`${where}: release (number), sustain and loop (booleans) are required`);

  if (e.loop) {
    if (!Number.isInteger(e.encoderDelay) || e.encoderDelay < 0) fail(`${where}: loop instruments need an integer encoderDelay (samples)`);
    for (const k of ['loops', 'pcmSamples'])
      if (!e[k] || typeof e[k] !== 'object') fail(`${where}: loop instruments need a "${k}" object`);
      else if (Object.keys(e[k]).sort((a, b) => a - b).join() !== (e.notes ?? []).join()) fail(`${where}: ${k} keys must match notes`);
  } else if (e.loops || e.pcmSamples) {
    fail(`${where}: loops/pcmSamples given but loop is false`);
  }

  let bytes = 0;
  for (const n of e.notes ?? []) {
    const file = new URL(`public/sounds/${e.id}/${n}.mp3`, root);
    try {
      bytes += (await stat(file)).size;
    } catch {
      fail(`${where}: missing public/sounds/${e.id}/${n}.mp3`);
      continue;
    }
    if (e.loop && e.loops?.[n] && e.pcmSamples?.[n] !== undefined) checkLoop(where, e, n, await readFile(file));
  }
  if (bytes !== e.bytes) fail(`${where}: bytes is ${e.bytes} but files on disk total ${bytes}`);
  try {
    const lic = await readFile(new URL(`public/sounds/${e.id}/LICENSE.txt`, root), 'utf8');
    if (!lic.includes(e.sourceUrl)) fail(`${where}: LICENSE.txt does not mention the source URL`);
  } catch {
    fail(`${where}: missing public/sounds/${e.id}/LICENSE.txt`);
  }
  totalBytes += bytes;
  console.log(`  ✓ ${e.id}: ${e.notes?.length} files, ${(bytes / 1024).toFixed(0)} KB, ${e.license}`);
}
console.log(`  total self-hosted audio: ${(totalBytes / 1024).toFixed(0)} KB`);
if (totalBytes > 3.5 * 1024 * 1024) warn('self-hosted audio exceeds the 3.5 MB budget');

/* ---------- 3. URLs ---------- */
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

if (!offline) {
  const urls = new Map(); // url -> where it is used
  const add = (url, where) => url && urls.set(url, [...(urls.get(url) ?? []), where]);
  for (const s of sources) add(s.url, `${s.title} (url)`), add(s.licenseUrl, `${s.title} (licenseUrl)`);
  for (const e of samples) add(e.sourceUrl, `${e.id} (sourceUrl)`), add(e.licenseUrl, `${e.id} (licenseUrl)`);

  console.log(`Checking ${urls.size} URLs…`);
  const list = [...urls.keys()];
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < list.length) {
        const i = next++;
        results[i] = { url: list[i], ...(await check(list[i])) };
      }
    }),
  );
  for (const { url, status, finalUrl, error } of results) {
    const host = new URL(url).host;
    if (status === 200) {
      const moved = finalUrl && finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '') ? ` (redirects to ${finalUrl})` : '';
      console.log(`  ✓ 200 ${url}${moved}`);
    } else if ((status === 403 || status === 429) && BOT_BLOCKING_HOSTS.includes(host)) {
      warn(`${status} ${url} (host blocks automated requests; check manually)`);
    } else {
      fail(`${status || error} ${url} — used by ${urls.get(url).join(', ')}`);
    }
  }
}

console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures ? 1 : 0);
