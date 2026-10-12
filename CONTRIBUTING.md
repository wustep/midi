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

Node 20+ is required. Verifying the catalog requires the [GitHub CLI](https://cli.github.com/) (`gh auth login`).

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

- Open source, hosted on GitHub, publicly accessible.
- MIDI is a core feature, not an incidental one (a general audio framework qualifies if its MIDI support is substantial and documented).
- Useful to others: documented, installable or buildable, and not a homework-sized experiment.
- Archived projects may stay if they remain widely used or historically important; they're flagged in the UI and README.

## Specs & resources links

Links on the Specs & Resources page live in [`data/resources.json`](data/resources.json). Run `npm run verify:resources` to confirm every URL still returns 200.

## Docs guidelines

- Accuracy beats completeness. Cite the relevant MIDI Association specification section where practical, and **recompute every worked example** (hex dumps, checksums, VLQs, bit layouts).
- If a detail is uncertain, say so or leave it out.
- Use the byte-chip classes for consistency: `<span class="b b-s">90</span>` (status), `b-d` (data), `b-m` (SysEx/meta).
- Keep the prose crisp: tables for lookup, short paragraphs for explanation, callouts for gotchas.

## Pull requests

- Keep PRs focused (one library batch or one docs topic per PR).
- `npm run build` must pass (it fails on broken internal links or invalid catalog data).
- By contributing you agree that code is licensed MIT ([LICENSE](LICENSE)) and docs/data are dedicated to the public domain under CC0 ([LICENSE-CC0](LICENSE-CC0)).
