/**
 * Site search: a compact index built at build time (src/pages/search.json.ts) and a small scorer that
 * runs in the browser. Every query word must match somewhere; title-word prefixes and exact titles
 * score highest, and tools/docs rank above external links.
 */

export type Kind = 'Tool' | 'Docs' | 'Section' | 'Glossary' | 'Controller' | 'Library' | 'Community' | 'MIDI files' | 'Spec' | 'Sounds';

/** One index entry, with short keys to keep the JSON small. */
export interface Entry {
  /** Title */
  t: string;
  /** URL (site-relative or absolute) */
  u: string;
  /** Kind */
  k: Kind;
  /** Short description */
  d?: string;
  /** Extra keywords (not shown) */
  x?: string;
}

export const KIND_ORDER: Kind[] = ['Tool', 'Docs', 'Section', 'Glossary', 'Controller', 'Library', 'Sounds', 'MIDI files', 'Community', 'Spec'];
const KIND_BOOST: Record<Kind, number> = { Tool: 6, Docs: 5, Section: 3, Glossary: 3, Controller: 3, Library: 1, Sounds: 1, 'MIDI files': 1, Community: 0, Spec: 1 };

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[^a-z0-9#+.\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface Prepared {
  e: Entry;
  title: string;
  words: string[];
  keys: string;
  desc: string;
}

export const prepare = (entries: Entry[]): Prepared[] =>
  entries.map((e) => {
    const title = normalize(e.t);
    return { e, title, words: title.split(/[\s/-]+/), keys: normalize(e.x ?? ''), desc: normalize(e.d ?? '') };
  });

export function score(p: Prepared, tokens: string[], whole: string): number {
  let s = 0;
  for (const tok of tokens) {
    if (p.words.some((w) => w.startsWith(tok))) s += p.words[0].startsWith(tok) ? 14 : 10;
    else if (p.title.includes(tok)) s += 6;
    else if (p.keys.split(' ').some((w) => w.startsWith(tok))) s += 5;
    else if (p.keys.includes(tok)) s += 3;
    else if (p.desc.includes(tok)) s += 1;
    else return 0;
  }
  if (p.title === whole) s += 30;
  else if (p.title.startsWith(whole)) s += 12;
  return s + KIND_BOOST[p.e.k] - p.title.length / 60;
}

export function search(index: Prepared[], query: string, limit = 40): Entry[] {
  const whole = normalize(query);
  if (!whole) return [];
  const tokens = whole.split(' ');
  const hits: { e: Entry; s: number }[] = [];
  for (const p of index) {
    const s = score(p, tokens, whole);
    if (s > 0) hits.push({ e: p.e, s });
  }
  hits.sort((a, b) => b.s - a.s || a.e.t.localeCompare(b.e.t));
  return hits.slice(0, limit).map((h) => h.e);
}

/** Group results by kind in a fixed order, keeping each group's rank order and the best hit's group first. */
export function group(results: Entry[]): [Kind, Entry[]][] {
  const map = new Map<Kind, Entry[]>();
  for (const r of results) {
    if (!map.has(r.k)) map.set(r.k, []);
    map.get(r.k)!.push(r);
  }
  return [...map.entries()];
}
