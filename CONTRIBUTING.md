# Contributing to MIDI Field Guide

Thanks for helping make this the best MIDI reference on the web. There are three kinds of contributions:

1. **Catalog entries**: add or update open-source libraries in [`data/libraries.json`](data/libraries.json).
2. **Docs fixes**: corrections and clarifications in [`src/pages/docs/`](src/pages/docs/).
3. **Site and tools**: the Astro site, interactive widgets, and scripts.

## Setup

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # validates data, regenerates README.md, builds dist/, then checks every internal link
```

Node 22.18+ is required (the tests run TypeScript directly). Verifying the catalog requires the [GitHub CLI](https://cli.github.com/) (`gh auth login`).

## Adding a library

Edit `data/libraries.json` and add an object to the array:

```json
{
  "name": "midir",
  "repo": "Boddlnagg/midir",
  "language": "Rust",
  "category": "realtime",
  "description": "Cross-platform realtime MIDI processing in Rust."
}
```

- `repo` is the GitHub `owner/name`. **Never invent or guess a repo.** Copy it from the project page.
- `host` is only for projects that left GitHub: set `"host": "codeberg"` and `repo` to the Codeberg `owner/name`. The verifier reads Codeberg's API for stars and last push, and keeps the curated `license` (Codeberg doesn't report an SPDX id). Add other forges to [`src/lib/repo.mjs`](src/lib/repo.mjs) and `scripts/verify-links.mjs` together.
- `category` must be one of the ids in [`data/categories.json`](data/categories.json).
- `language` is the primary language or ecosystem a user would consume it from (e.g. `C++ / Python` for bindings-first projects).
- `description` is one sentence, neutral in tone, no marketing superlatives, ending with a period. Say what it does for MIDI specifically.
- Leave `license`, `stars`, `pushedAt`, `archived`, and `verifiedAt` out; the verifier fills them in.

Then run:

```sh
npm run verify      # checks every repo with `gh api repos/OWNER/NAME`, refreshes metadata, drops 404s
npm run check:data  # schema + duplicate check
npm run readme      # regenerates README.md from the data
```

Commit `data/libraries.json` **and** the regenerated `README.md`. Never edit `README.md` by hand.

### Inclusion criteria

- Open source, hosted on GitHub (or Codeberg, see `host`), publicly accessible.
- MIDI is a core feature, not an incidental one (a general audio framework qualifies if its MIDI support is substantial and documented).
- Useful to others: documented, installable or buildable, and not a homework-sized experiment.
- Archived projects may stay if they remain widely used or historically important; they're flagged in the UI and README.

### Starter picks

[`data/picks.json`](data/picks.json) lists a few dependable first choices per language, shown at the top of the catalog and in the README. Every pick must be a non-archived entry in \`libraries.json\` with a one-sentence reason (\`npm run check:data\` enforces this). Keep it short: a pick should be the library most people in that language would recommend first.

## Specs, community and MIDI-file links

- [`data/resources.json`](data/resources.json): official specs and references (Specs & Resources page).
- [`data/community.json`](data/community.json): forums, subreddits, Discord servers and mailing lists. Discord entries **must** include a `source`: the official project page where the invite is published.
- [`data/midi-files.json`](data/midi-files.json): MIDI archives and datasets. Every entry needs a `license`, a `licenseNote` taken from the source itself, and `commercialUse` (`yes`, `no`, `varies` or `unclear`). Don't guess; use `unclear`. If a site blocks scripted checks and you can't confirm its terms from the source, set `license` to `Not verified`, say so in `licenseNote`, and tell readers where to check. Sources left out on purpose are named with the reason under the list on [`/community/midi-files/`](src/pages/community/midi-files.astro).

Run `npm run verify:resources` to check every URL and the shape of all three files. **Never invent a URL.** Redirects are followed, and anything that can't be confirmed is reported as **unverified** rather than passing: bot-challenge pages (Debian's "I Challenge Thee", Cloudflare, Anubis), even when they answer 200, and refusals from hosts in `BOT_BLOCKING_HOSTS`. Check those in a browser. Detection lives in [`scripts/lib/http.mjs`](scripts/lib/http.mjs), shared with `verify:samples`.

## Samples

[`data/sample-sources.json`](data/sample-sources.json) lists link-out sources for free instruments. Self-hosted, playable instruments live in [`data/samples.json`](data/samples.json) with audio in `public/sounds/<id>/<midi-note>.mp3` and a `LICENSE.txt` per instrument. Only self-host sounds whose license allows redistribution (CC0, CC BY, CC BY-SA, MIT), show the attribution, and keep each instrument small (a few repitched notes). `npm run verify:samples` checks the URLs, files, sizes and licenses.

## Site structure

- **Design system:** read [`docs/DESIGN.md`](docs/DESIGN.md) (live at [/design/](https://midi.community/design/)). Tokens live in [`src/styles/tokens.css`](src/styles/tokens.css) and the shared primitives in [`src/styles/global.css`](src/styles/global.css). Components use semantic tokens only (`--s-*`, `--t-*`, `--r-*`, `--surface*`, `--ease-*`, `--d-*`); a raw color, size or duration in a component is a bug.
- **Page shells:** every page uses the shared `.page` shell and `.page-head` header (eyebrow = section name), with cards from `.card-grid`/`.card`, tools on a `.widget` panel and directory lists from `.link-rows`.
- **Cross-links:** how docs, tools and library categories relate lives in one place, [`src/lib/related.ts`](src/lib/related.ts). Docs pages show "Try it / Code" links from it, tool pages show Background and Libraries links, and the catalog shows "Read first" for a category. Add relations there, not as hand-written callouts.
- **Search:** the ⌘K palette and `/search/` use an index built at build time by [`src/pages/search.json.ts`](src/pages/search.json.ts) from the docs headings, tools, glossary, CC table and every data file. New data shows up automatically.

## Automation

A weekly GitHub Action ([\`.github/workflows/verify.yml\`](.github/workflows/verify.yml)) re-verifies every library, regenerates the README, runs the tests and the external-link checks, and opens a pull request with any metadata changes. Review removals and renames before merging; a bot challenge or a 403 from a site that blocks bots is reported as unverified, not as a failure or a pass.

## README screenshots

The images in \`.github/readme/\` are screenshots of the live site (home, Reader, a docs page with a diagram, tools hub) at 1440 px, resized to 1200 px wide JPEGs (about 100–200 KB each). Retake them when the pages change noticeably.

## Social images and fonts

- **Social cards:** one 1200×630 PNG per section, `/og/<section>.png`, rendered at build time by [`src/pages/og/[section].png.ts`](src/pages/og/%5Bsection%5D.png.ts) with [satori](https://github.com/vercel/satori) and [resvg](https://github.com/thx/resvg-js). The layout and copy live in [`src/lib/og-card.ts`](src/lib/og-card.ts); every number on a card is counted from the data files and registries, so cards update themselves. Preview them in `dist/og/` after `npm run build`, or at `/og/home.png` under `npm run dev`.
- **Card fonts:** satori needs static TTF/OTF, so [`src/og/fonts/`](src/og/fonts/) holds instances of the site fonts cut from the `@fontsource-variable` files with fontTools, subset to Latin plus typographic punctuation: Archivo at wdth 125/wght 900, wdth 120/wght 700 and wdth 100/wght 500; Atkinson Hyperlegible Next 400; Atkinson Hyperlegible Mono 400 and 700 (`fonttools varLib.instancer <file> wdth=125 wght=900`, then `pyftsubset`). OFL license texts sit next to them.
- **Display font:** `public/fonts/archivo-display.woff2` is Archivo instanced to weights 400–900 and widths 100–125% and subset to Latin, punctuation, arrows and ♯♭ with fontTools (`fonttools varLib.instancer` then `pyftsubset … --flavor=woff2`). Use only those ranges in CSS. License: `public/fonts/Archivo-OFL.txt`.

## Tools and tests

The interactive tools are Astro components backed by dependency-free modules in [`src/lib/`](src/lib/) (SMF parsing, SysEx, synth, sampler). Keep logic in `src/lib/` and cover it in [`tests/`](tests/): `npm test` runs them with Node's built-in test runner (Node 22.18+ for TypeScript type stripping). The MIDI Reader's demo files are generated by `node scripts/make-demos.mjs`.

## Docs guidelines

- Accuracy beats completeness. Cite the relevant MIDI Association specification section where practical, and **recompute every worked example** (hex dumps, checksums, VLQs, bit layouts).
- If a detail is uncertain, say so or leave it out.
- Use the byte-chip classes for consistency: `<span class="b b-s">90</span>` (status), `b-d` (data), `b-m` (SysEx/meta).
- Keep the prose crisp: tables for lookup, short paragraphs for explanation, callouts for gotchas.

## Pull requests

- Keep PRs focused (one library batch or one docs topic per PR).
- `npm run build` must pass (it fails on broken internal links or invalid catalog data).
- By contributing you agree that code is licensed MIT ([LICENSE](LICENSE)) and docs/data are dedicated to the public domain under CC0 ([LICENSE-CC0](LICENSE-CC0)).
