/**
 * Shared URL fetching for the link checkers (verify-resources.mjs, verify-samples.mjs).
 *
 * Some hosts answer scripted requests with a bot-challenge page instead of an error status: Debian's
 * servers redirect to /.internal/challenge.html ("I Challenge Thee") and answer 200, Cloudflare and
 * Anubis serve their interstitials. A 200 like that proves nothing about the real page, so `get()`
 * reports it as `challenge` and the checkers count it as unverified rather than passing.
 */

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** How much of a final response body to read when looking for a challenge page. */
const SNIFF_BYTES = 32 * 1024;

const CHALLENGE_PATHS = [/\/\.internal\/challenge/i, /\/cdn-cgi\/challenge-platform\//i, /\/\.within\.website\//i];
const CHALLENGE_BODIES = [
  [/<title>\s*I Challenge Thee\s*<\/title>/i, 'Debian bot challenge'],
  [/<title>\s*Just a moment\.\.\.\s*<\/title>/i, 'Cloudflare challenge'],
  [/<title>\s*Making sure you(?:&#39;|')re not a bot!?\s*<\/title>/i, 'Anubis challenge'],
];

/**
 * Names the bot challenge a response is, or returns null for a real page.
 * @param {string} finalUrl URL after redirects
 * @param {string} body start of the response body (may be empty)
 */
export function detectChallenge(finalUrl, body = '') {
  let path = '';
  try {
    path = new URL(finalUrl).pathname;
  } catch {}
  if (CHALLENGE_PATHS.some((re) => re.test(path))) return /\.internal\/challenge/i.test(path) ? 'Debian bot challenge' : 'bot challenge';
  for (const [re, name] of CHALLENGE_BODIES) if (re.test(body)) return name;
  return null;
}

/** Reads at most `limit` bytes of a response body as text, then cancels the rest. */
async function sniff(res, limit = SNIFF_BYTES) {
  if (!res.body || !/html|text/i.test(res.headers.get('content-type') ?? '')) {
    await res.body?.cancel();
    return '';
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * fetch() with manual redirects and a cookie jar (some hosts redirect-loop until a cookie is set).
 * Resolves to { status, finalUrl, redirected, challenge } where `challenge` names a bot-challenge page or is null.
 */
export async function get(url, { timeout = 20_000 } = {}) {
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
      signal: AbortSignal.timeout(timeout),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      url = new URL(location, url).href;
      redirected = true;
      continue;
    }
    const body = await sniff(res);
    return { status: res.status, finalUrl: url, redirected, challenge: detectChallenge(url, body) };
  }
  throw new Error('too many redirects');
}
