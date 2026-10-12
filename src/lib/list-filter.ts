/**
 * Client-side filtering for long grouped lists (Community, Getting MIDI files): a search box plus a row
 * of single-select topic chips. Markup contract:
 *   [data-filter-root]
 *     input[data-filter-q]
 *     button[data-filter-tag="…"]  (value "" means all)
 *     details[data-group] > summary [data-group-count]
 *       [data-item][data-text="lowercased searchable text"][data-tags="a b c"]
 *     details[data-group][data-limit="8"] shows that many items until expanded (ignored while filtering)
 *     [data-filter-empty]
 *     [data-filter-status]
 * The active topic is mirrored in ?topic= so filtered views can be linked.
 */

/** Pure matcher, exported for tests. */
export function matches(text: string, tags: string[], query: string, tag: string): boolean {
  if (tag && !tags.includes(tag)) return false;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => text.includes(w));
}

export function initListFilter(root: HTMLElement) {
  const q = root.querySelector<HTMLInputElement>('[data-filter-q]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-tag]')];
  const groups = [...root.querySelectorAll<HTMLDetailsElement>('details[data-group]')];
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const initialOpen = new Map(groups.map((g) => [g, g.open]));
  let tag = new URLSearchParams(location.search).get('topic') ?? '';
  if (!chips.some((c) => c.dataset.filterTag === tag)) tag = '';

  const apply = () => {
    const query = q?.value.trim() ?? '';
    const active = Boolean(query || tag);
    let total = 0;
    for (const g of groups) {
      let n = 0;
      const limit = active || 'expanded' in g.dataset ? Infinity : Number(g.dataset.limit ?? Infinity);
      const items = [...g.querySelectorAll<HTMLElement>('[data-item]')];
      for (const item of items) {
        const ok = matches(item.dataset.text ?? '', (item.dataset.tags ?? '').split(' ').filter(Boolean), query, tag);
        item.hidden = !ok || n >= limit;
        if (ok) n++;
      }
      let more = g.querySelector<HTMLButtonElement>('[data-show-all]');
      if (n > limit) {
        if (!more) {
          more = document.createElement('button');
          more.type = 'button';
          more.className = 'btn show-all';
          more.dataset.showAll = '';
          more.addEventListener('click', () => {
            g.dataset.expanded = '';
            apply();
          });
          g.append(more);
        }
        more.hidden = false;
        more.textContent = `Show all ${n}`;
      } else if (more) more.hidden = true;
      total += n;
      g.hidden = n === 0;
      const count = g.querySelector('[data-group-count]');
      if (count) count.textContent = active ? `${n} of ${g.querySelectorAll('[data-item]').length}` : String(n);
      // Show matches in every group while filtering; restore the reader's choice afterwards.
      g.open = active ? n > 0 : initialOpen.get(g)!;
    }
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filterTag === tag)));
    if (empty) empty.hidden = total > 0;
    if (status) status.textContent = active ? `${total} match${total === 1 ? '' : 'es'}` : '';
  };

  chips.forEach((c) =>
    c.addEventListener('click', () => {
      tag = c.dataset.filterTag ?? '';
      const url = new URL(location.href);
      if (tag) url.searchParams.set('topic', tag);
      else url.searchParams.delete('topic');
      history.replaceState(null, '', url);
      apply();
    }),
  );
  q?.addEventListener('input', apply);
  groups.forEach((g) => g.addEventListener('toggle', () => {
    if (!q?.value.trim() && !tag) initialOpen.set(g, g.open);
  }));
  apply();
}
