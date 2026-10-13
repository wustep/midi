# Themes

The site has one design system and a set of themes on top of it. A theme is plain data: colors for a light palette, a dark palette or both, three or four fonts, and a few type and shape settings. The list of themes lives in one file, [`src/themes/registry.ts`](../src/themes/registry.ts). Everything else (CSS, fonts, the picker, the [/design/](https://midi.community/design/#themes) page, the contrast tests) follows that list.

| File | What it does |
|---|---|
| [`src/themes/registry.ts`](../src/themes/registry.ts) | **The list.** Order is picker order; the first theme is the default (without JavaScript, and for social cards) |
| `src/themes/<id>.ts` | One theme each: `light` and/or `dark` palettes, `fonts`, `vars`, and an optional `css` escape hatch |
| [`src/themes/types.ts`](../src/themes/types.ts) | The `Theme` and `Palette` shapes, with what each color is for |
| [`src/themes/kit.ts`](../src/themes/kit.ts) | Shared textures (step grid, piano roll, staves, drafting grid, dots, scanlines, grain) and shadow recipes |
| [`src/themes/fonts.ts`](../src/themes/fonts.ts), [`font-files.ts`](../src/themes/font-files.ts) | The font catalog: family names and fallbacks, and the self-hosted files (OFL, Latin subset) |
| [`src/themes/css.ts`](../src/themes/css.ts) | Build time: compiles the registry into CSS custom properties, `@font-face` rules and the boot script |
| [`src/themes/choose.ts`](../src/themes/choose.ts) | Which theme a visitor gets: the random first pick, what's saved, and the mode. The boot script and the picker's functions, side by side |
| [`src/components/ThemePicker.astro`](../src/components/ThemePicker.astro) | The picker in the header |
| [`tests/themes.test.ts`](../tests/themes.test.ts) | Every theme and mode against WCAG AA |
| [`tests/theme-choice.test.ts`](../tests/theme-choice.test.ts) | The random pick's filter and what's kept, with the real boot script run against a fake page |

## Keeping a subset (or just one)

1. Open `src/themes/registry.ts` and delete the themes you don't want from `THEMES`, along with their `import` lines. Put the one you want as the default (no JavaScript, social cards) first.
2. Optionally delete the removed `src/themes/<id>.ts` files, and any `@fontsource*` packages in `package.json` that no remaining theme uses (`FONT_FILES` in `font-files.ts` lists which package each font comes from; remove those entries too).
3. Run `npm test` and `npm run build`.

That's all. What follows from the list:

- **CSS and fonts:** only registered themes are compiled into the page, and `@font-face` rules are written only for fonts a registered theme uses. A browser downloads a font only when the active theme uses it.
- **The picker:** lists exactly the registered themes, numbered in order. With **one theme** the picker isn't rendered at all; if that theme has both a light and a dark palette, a plain light/dark switch takes its place in the header. With a one-mode theme, there's nothing in the header to switch.
- **Random first visits:** draw only from registered themes, so a removed theme is never picked.
- **Saved choices:** a visitor whose saved theme was removed is treated like a first visit and gets a new random theme. The old `theme=light|dark` setting from before themes is saved as their Light or Dark choice.
- **/design/** shows a card for each registered theme, and the contrast tests run for each.
- **Social cards** (`/og/*.png`) take their colors from the default theme's palette (light, if it has one). Their fonts and the favicons stay the brand's.

## Which theme a visitor gets

- **First visit: a random theme**, drawn only from the themes that have the visitor's mode. With the system in light mode that's every theme with a light palette (not Rhythm, Phosphor or After Hours); in dark mode, every theme with a dark palette (not Riso). If the visitor has already chosen Light or Dark, that choice is the filter instead of the system's. If no registered theme has the mode, any theme can come up.
- **It's kept.** The random theme is saved in `localStorage` (`theme`) like a pick, so it stays the same across pages and reloads, and after the system switches between light and dark.
- **Picking a theme** saves it the same way. **Surprise me**, at the bottom of the picker, rolls again with the same filter (never landing on the theme that's on) and saves the result.
- **Light or dark:** a two-mode theme follows the system unless the reader picks Light or Dark in the picker (saved as `theme-mode`; Auto removes it).
- **One-mode themes** (Rhythm, Phosphor and After Hours are dark only; Riso is light only) always show their own mode. While one is on, the Auto / Light / Dark switch shows that mode, is disabled, and says "Dark only" or "Light only". The reader's Auto / Light / Dark choice is kept for the next two-mode theme. A system change never changes the theme.
- **The picker marks each theme's modes:** a sun for light, a moon for dark, both for a theme with both. The readout under the list says it in words.
- **Storage blocked** (cookies off, some private windows): nothing can be saved, so instead of a different random theme on every page, the visitor gets the first theme in the list that has their mode.
- **Without JavaScript:** the default theme (the first in the list), following the system's light or dark setting.

## How it applies

- `<html data-theme="<id>" data-mode="light|dark">`. Each theme compiles to a `:root[data-theme="<id>"]` block of custom properties, and a `[data-mode="dark"]` block if it has both palettes.
- An inline boot script in `<head>` (`bootScript()` in `choose.ts`, filled in with the registry by `css.ts`) reads `localStorage` (`theme`, `theme-mode`), rolls and saves a theme if there isn't one, sets both attributes before first paint, so there's no flash, updates `<meta name="theme-color">`, and preloads that theme's text and display fonts. It's ES5 because it runs as written. The picker uses the same rules from the TypeScript functions next to it; `tests/theme-choice.test.ts` runs the script and holds it to them.
- Changing theme dispatches a `themechange` event on `window`. Canvas-drawn tools (the Reader's piano roll) also watch the `data-theme` and `data-mode` attributes and redraw.

## Adding a theme

Copy a theme file close to what you want, give it a new `id`, and add it to `THEMES`.

- **Palette:** every key in `Palette` (see `types.ts`). Colors that are checked for contrast must be `#rrggbb`. `npm test` tells you exactly which pairs fail and by how much.
- **Fonts:** keys from `FONTS`. To add a typeface, install its `@fontsource` or `@fontsource-variable` package, add the family to `fonts.ts` and its Latin files to `font-files.ts`.
- **Vars:** type and shape settings with defaults in `tokens.css`: `--display-*` (home headline), `--h1-*`, `--heading-*`, `--label-*` (the small uppercase "silkscreen" labels), `--r-*` radii, `--t-display` and `--t-base`, `--led-blur`, `--glow`, `--texture` and `--texture-at`, `--grain`.
- **`css`:** for what tokens can't say (a redrawn beat ruler, an italic headline word). It's nested CSS scoped to the theme. Keep it short.

## The twelve

| # | Theme | Modes | Direction |
|---|---|---|---|
| 01 | Field Guide | Light, dark | Warm paper and ink, with an ember status byte. A printed reference you can play |
| 02 | Rhythm | Dark | A drum machine at night: charcoal panel, condensed silkscreen, and red-orange-yellow step lights |
| 03 | Alloy | Light, dark | Bead-blasted aluminum, black print and one orange key. A pocket synth's industrial design |
| 04 | Score | Light, dark | An engraved edition: ivory paper, serif type, oxblood markings, and staves for section breaks |
| 05 | Phosphor | Dark | A sequencer on an amber CRT: all monospace, amber phosphor, a faint glow on what's lit |
| 06 | Piano Roll | Light, dark | A DAW at 2 a.m.: slate lanes, a bar ruler, lime notes and rounded clips |
| 07 | Blueprint | Light, dark | The spec as a technical drawing: drafting grid, condensed engineering type, square corners. Cyanotype in the dark |
| 08 | Swiss | Light, dark | International style: white, black and one red; a tight grotesk set big, flush left, square |
| 09 | Riso | Light | A risograph zine: cream stock, blue and fluorescent-pink inks printed a touch off-register |
| 10 | Analog | Light, dark | A 1970s synth panel: cream enamel, burnt orange and avocado, wide extended legends. Walnut at night |
| 11 | After Hours | Dark | The club at 3 a.m.: violet-black, magenta and cyan light, a wide rounded display face |
| 12 | Graphite | Light, dark | A modern dev tool: cool neutrals, crisp hairlines, one electric blue. The quiet option |
