# Design system

The MIDI Field Guide has one set of design tokens and a small library of CSS primitives. Everything on the site is built from them. The live version of this document, with every token rendered in both themes, is at **[/design/](https://midi.community/design/)** ([`src/pages/design.astro`](../src/pages/design.astro)).

| File | What lives there |
|---|---|
| [`src/styles/tokens.css`](../src/styles/tokens.css) | Every token: primitives, semantic colors (light and dark), type, space, radii, sizes, motion, focus, layers |
| [`src/styles/global.css`](../src/styles/global.css) | Base element styles and the shared primitives (cards, panels, tables, badges, callouts, buttons, chips, segmented controls, fields, sub-navigation) |
| [`src/layouts/Base.astro`](../src/layouts/Base.astro) | Header, footer, phone menu |
| [`src/lib/icons.mjs`](../src/lib/icons.mjs) | The icon set and brand mark; `<Icon>` ([`src/components/Icon.astro`](../src/components/Icon.astro)) renders one |
| [`scripts/make-icons.mjs`](../scripts/make-icons.mjs) | Generates the favicons, touch icon and manifest icons from the brand mark |
| [`src/lib/copy.ts`](../src/lib/copy.ts) | The one copy-to-clipboard behavior |

## Principles

1. **Color means a byte role.** Ember is a status byte, teal is data, violet is meta/SysEx, amber is a warning. Decoration never borrows them: category tags, borders and hover states stay neutral.
2. **Paper and ink.** Warm, printed-reference neutrals. Depth comes from three surface levels, not from heavy shadows.
3. **Quiet until touched.** Links rest with a faint underline; controls answer on hover only with a fine pointer, and always answer on press.
4. **Fast, honest motion.** Under 300 ms, custom ease-out curves, nothing on keyboard shortcuts, and no movement with reduced motion.

## Tokens

Components use **semantic** tokens only (`--bg`, `--ink`, `--accent`, `--s-4`, `--t-md`, `--r-md`, `--ease-out`). Semantic colors point at a **primitive** palette (`--paper-*`, `--night-*`, `--ember-*`, `--teal-*`, `--violet-*`, `--amber-*`, `--blue-*`); dark mode swaps only that mapping. A raw hex value, pixel size or duration in a component is a bug. Add or reuse a token instead.

### Color

| Token | Role |
|---|---|
| `--bg` | The page |
| `--surface-sunken` | Wells: inputs, code, readouts, drop zones |
| `--surface` | Raised: cards, panels, tables, buttons |
| `--surface-raised` | Floating: dialogs, the selected segment |
| `--surface-2` | Hover fills, neutral badges, table heads |
| `--ink`, `--ink-2`, `--muted` | Text, from primary to meta. `--muted` is at least 4.5:1 on every surface |
| `--line`, `--line-strong`, `--control` | Hairlines, raised edges, field borders. `--control` is at least 3:1 |
| `--accent` / `--accent-soft` | Status bytes, links, the current section |
| `--data` / `--data-soft` | Data bytes, success, "copied" |
| `--meta` / `--meta-soft` | Meta events, SysEx |
| `--warn` / `--warn-soft` | Cautions, unverified, stale |
| `--focus` | Keyboard focus only |
| `--sky`, `--olive` | Extra chart series (CC kinds) |

`prefers-contrast: more` strengthens lines and muted text and thickens the focus ring.

### Type

Archivo (expanded widths) for display, Atkinson Hyperlegible Next for text, Atkinson Hyperlegible Mono for bytes. Sizes are rem so they follow the reader's text size.

| Token | Size | Use |
|---|---|---|
| `--t-display` | 42–86px | Home hero, 404 |
| `--t-3xl` | 34–50px | Page titles |
| `--t-2xl` | 23–30px | Section titles |
| `--t-xl` | 24px | Large numbers |
| `--t-lg` | 20px | Lede, h3 |
| `--t-base` | 17px | Body |
| `--t-ui` | 15px | Buttons, nav, inputs |
| `--t-md` | 14px | Card text, tables, small buttons |
| `--t-sm` | 13px | Hints, dense UI |
| `--t-xs` | 12px | Captions, badges, uppercase labels |
| `--t-2xs` | 11px | Axis and key labels |

Tracking is size-specific: `--tr-display` (−0.03em) on display type, `--tr-heading` on headings, `--tr-label` (0.08em) and `--tr-eyebrow` (0.12em) on uppercase labels. Leading runs from `--lh-body` 1.6 down to `--lh-display` 1.0.

### Space, radii, sizes

- **Space** is a 4px scale: `--s-0` 2 · `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64 · `--s-9` 96.
- **Radii** step down one size per nesting level: `--r-2xs` 2 (keys) · `--r-xs` 4 (byte chips, badges, kbd) · `--r-sm` 7 (controls) · `--r-md` 11 (cards, tables, code) · `--r-lg` 16 (panels, dialogs) · `--r-pill`.
- **Control heights:** `--h-sm` 32, `--h-md` 40, `--h-lg` 48. On coarse pointers every control grows to `--h-touch` (44px).

### Elevation

| Level | Surface | Shadow | Use |
|---|---|---|---|
| Sunken | `--surface-sunken` | `--shadow-inset` | Something you type or read into |
| Page | `--bg` | none | |
| Raised | `--surface` | `--shadow-1` | Cards and buttons at rest |
| Panel | `--surface` | `--shadow-2` | Tool panels; cards on hover |
| Floating | `--surface-raised` | `--shadow-3` | Search palette, dialogs |

Shadows are short, warm and lit from above, with a highlight on the top edge. Don't put a raised box inside a panel; inside a panel, use a sunken well or hairline rows.

### Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entering, responding, exiting |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Moving something already on screen |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Menus and sheets opening |
| `--d-press` | 100ms | Press feedback: `scale(var(--press-scale))`, 0.97 |
| `--d-exit` | 120ms | Exits, which are faster than entrances |
| `--d-fast` | 140ms | Hover and color |
| `--d-base` | 200ms | Toggles, chevrons, popovers |
| `--d-slow` | 280ms | Dialogs, the phone menu, theme change |

Rules:

- Use transitions, not keyframes, for anything that can be re-triggered, so it can reverse mid-flight.
- No `ease-in` on UI. No animation on keyboard-triggered actions: the search palette opens instantly on ⌘K and `/`, and fades in only when clicked.
- Hover effects go inside `@media (hover: hover) and (pointer: fine)`. Press feedback (`:active`) applies everywhere.
- `prefers-reduced-motion` sets `--press-scale` to 1 and removes keyframed movement; color and opacity transitions stay. `prefers-reduced-transparency` makes the header solid.

### Focus

One ring: `outline: var(--focus-width) solid var(--focus)` at `--focus-offset`, following the element's radius. Text fields swap their border to `--focus` and add a soft halo instead of an outline.

## Icons

One set, drawn for this site, in [`src/lib/icons.mjs`](../src/lib/icons.mjs). Use `<Icon name="search" size={20} />` in Astro markup and `iconSvg('search', { size: 20 })` in client scripts; both are decorative (`aria-hidden`) unless you pass `label`.

- **Grid:** 24 × 24 with a 2px safe area. Nothing, including stroke, crosses into it (`tests/icons.test.ts` checks every icon).
- **Stroke:** one 2px stroke, round caps, round joins. It scales with the icon (1.33px at 16px), so don't redraw at small sizes.
- **Shapes:** rectangles take a 2px corner radius. Keylines are a circle of r 9, a 16px square and a 14 × 18 upright.
- **Fills:** only the media glyphs (play, pause, stop) and the star are solid, drawn as the same outline filled so corners stay round.
- **Optical alignment:** arrows and chevrons sit on the centre lines; play is nudged right.
- **From CSS:** the chevrons used by fold groups, disclosures and selects are `--i-chevron-right`, `--i-chevron-down` and `--i-select` in `tokens.css`, the same paths as the set (a test keeps them equal). Paint them with `mask` and `background: currentColor`.
- **Brand:** `din` is the DIN-5 MIDI socket: the ring, the key notch at the top and five pins on the lower half-circle, with pin 2 in `--pin` (the accent in the header). The favicons (SVG, ICO 16/32/48), Apple touch icon and manifest icons are generated from it by `node scripts/make-icons.mjs`. Small sizes use a heavier ring with the pins pulled inward so they stay legible.
- **Text arrows** (→ in "All 17 chapters →") are typography, not icons, and stay as characters.

To add an icon, draw it on the grid with the rules above, add it to `ICONS`, and check it at 16, 20 and 32px on [/design/#icons](https://midi.community/design/#icons).

## Primitives

| Class | What it is |
|---|---|
| `.page`, `.page-head`, `.eyebrow`, `.lede`, `.crumbs` | Page shell and header |
| `.card-grid`, `.card` (`.card-kicker`, `.card-title`, `.card-text`, `.card-meta`) | Raised cards; an `a.card` lifts on hover and presses on click |
| `.widget` (`.widget-head`, `.widget-title`, `.widget-tag`) | The panel every tool sits on |
| `.link-rows` (`.lr-*`) | Ruled directory lists |
| `details.fold-group` | Grouped lists that fold on phones |
| `.table-wrap` + `table` | Tables, which scroll sideways on small screens |
| `.b .b-s / .b-d / .b-m` | Byte chips: status, data, meta |
| `.badge` (`.good`, `.bad`, `.warn`, `.meta`) | Short status labels |
| `kbd` | Keys |
| `.callout` (`.warn`, `.note`), via `<Callout>` | Asides |
| `.btn` (`.btn-primary`, `.btn-ghost`, `.btn-sm`, `.btn-lg`) | Actions. One primary per view. Copy buttons use `.btn.btn-sm` with `bindCopy()` |
| `.icon-btn` | Square icon-only actions; always give them an `aria-label` |
| `.chip` | Filter toggles (`aria-pressed`) and example presets. Not for one-shot actions |
| `.seg` | Segmented control: one choice of a few, as `aria-pressed` buttons or `role="tab"` |
| `.subnav` | Pages within a section, with the same accent bar as the header |
| Fields | `input`, `select`, `textarea` are sunken wells; `.field-label` above them; checkboxes, radios and ranges use the accent color |

When you need something new, first check whether it's a variant of one of these. If it isn't, add it to `global.css` and to `/design/`, not to a single page.
