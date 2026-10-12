import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectChallenge } from '../scripts/lib/http.mjs';

test('Debian challenge redirect is detected from the final URL', () => {
  const url = 'https://packages.debian.org/.internal/challenge.html?original=%2fsid%2ffluid-soundfont-gm&referer=';
  assert.equal(detectChallenge(url, ''), 'Debian bot challenge');
});

test('challenge pages are detected from the body', () => {
  assert.equal(detectChallenge('https://x.example/', '<html><title>I Challenge Thee</title>'), 'Debian bot challenge');
  assert.equal(detectChallenge('https://x.example/', '<title>Just a moment...</title>'), 'Cloudflare challenge');
  assert.equal(detectChallenge('https://x.example/', "<title>Making sure you're not a bot!</title>"), 'Anubis challenge');
});

test('ordinary pages are not challenges', () => {
  assert.equal(detectChallenge('https://packages.debian.org/sid/fluid-soundfont-gm', '<title>Debian -- Details of package</title>'), null);
  assert.equal(detectChallenge('not a url', ''), null);
});
