/**
 * One map of how docs, tools and library categories relate, so every page links its neighbours
 * consistently instead of through hand-written callouts.
 */
import { tools, type Tool } from './tools';
import { docsFlat } from './docs-nav';
import categories from '../../data/categories.json';

/** Docs chapter → tools to try it with, and library categories with code for it. */
export const DOC_RELATIONS: Record<string, { tools: string[]; libs: string[] }> = {
  messages: { tools: ['decoder', 'monitor'], libs: ['realtime', 'utilities'] },
  notes: { tools: ['notes', 'chords'], libs: ['notation'] },
  'control-change': { tools: ['cc', 'rpn'], libs: ['hardware', 'realtime'] },
  'rpn-nrpn': { tools: ['rpn', 'cc'], libs: ['realtime'] },
  sysex: { tools: ['sysex', 'decoder', 'monitor'], libs: ['editors', 'utilities'] },
  timing: { tools: ['clock', 'tempo'], libs: ['realtime', 'daw'] },
  smf: { tools: ['reader', 'vlq'], libs: ['smf', 'datasets'] },
  'general-midi': { tools: ['reader', 'notes'], libs: ['synthesis'] },
  mpe: { tools: ['mpe'], libs: ['hardware', 'synthesis'] },
  'midi-2': { tools: [], libs: ['midi2'] },
  'midi-ci': { tools: ['sysex'], libs: ['midi2'] },
  transports: { tools: ['monitor', 'clock'], libs: ['hardware', 'network'] },
  cookbook: { tools: ['monitor'], libs: ['realtime', 'smf', 'web'] },
};

/** Tool → library categories that implement the same thing in code. */
export const TOOL_LIBS: Record<string, string[]> = {
  reader: ['smf', 'utilities'], monitor: ['realtime', 'web'], clock: ['realtime', 'utilities'], sysex: ['editors', 'utilities'],
  rpn: ['realtime'], mpe: ['hardware', 'synthesis'], cc: ['hardware', 'realtime'], chords: ['notation'], decoder: ['utilities'],
  vlq: ['smf'], tempo: ['daw'], notes: ['notation', 'synthesis'],
};

const catById = new Map(categories.map((c) => [c.id, c]));
const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

export interface LinkItem {
  label: string;
  href: string;
}

export const libLink = (id: string): LinkItem => ({ label: catById.get(id)?.short ?? id, href: `/libraries/?cat=${id}` });

export function relatedForDoc(slug: string): { tools: Tool[]; libs: LinkItem[] } {
  const r = DOC_RELATIONS[slug];
  if (!r) return { tools: [], libs: [] };
  return { tools: r.tools.map((s) => toolBySlug.get(s)!).filter(Boolean), libs: r.libs.map(libLink) };
}

export const libsForTool = (slug: string): LinkItem[] => (TOOL_LIBS[slug] ?? []).map(libLink);

/** Library category → the docs chapter to read first (the first chapter that lists it). */
export function docsForCategory(id: string): LinkItem[] {
  return docsFlat.filter((d) => DOC_RELATIONS[d.slug]?.libs.includes(id)).slice(0, 2).map((d) => ({ label: d.title, href: `/docs/${d.slug}/` }));
}

/** Tools for a library category (reverse of TOOL_LIBS). */
export function toolsForCategory(id: string): Tool[] {
  return tools.filter((t) => TOOL_LIBS[t.slug]?.includes(id)).slice(0, 3);
}
