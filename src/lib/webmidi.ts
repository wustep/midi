/** Small helpers shared by the tools that talk to Web MIDI devices. Browser-only. */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const cache = new Map<boolean, Promise<MIDIAccess>>();

/** Request MIDI access once per page (SysEx access is requested separately when needed). */
export function midiAccess(sysex = false): Promise<MIDIAccess> {
  if (!('requestMIDIAccess' in navigator)) {
    return Promise.reject(new Error("This browser doesn't support Web MIDI. Try Chrome, Edge, Firefox or Opera on desktop."));
  }
  let p = cache.get(sysex);
  if (!p) {
    p = navigator.requestMIDIAccess({ sysex }).catch((e: Error) => {
      cache.delete(sysex);
      throw new Error(e?.name === 'SecurityError' || e?.name === 'NotAllowedError' ? 'MIDI access was blocked. Allow it in the site settings and try again.' : e?.message || 'MIDI access failed.');
    });
    cache.set(sysex, p);
  }
  return p;
}

/**
 * Fill a <select> with ports and keep it in sync as devices come and go. Keeps the current choice
 * when possible. Returns a function that reads the selected port.
 */
export function bindPortSelect<T extends MIDIInput | MIDIOutput>(access: MIDIAccess, select: HTMLSelectElement, kind: 'inputs' | 'outputs', opts: { none?: string; onChange?: () => void } = {}): () => T | undefined {
  const map = access[kind] as unknown as Map<string, T>;
  const fill = () => {
    const current = select.value;
    const ports = [...map.values()];
    select.innerHTML =
      (opts.none ? `<option value="">${esc(opts.none)}</option>` : '') +
      (ports.length ? ports.map((p) => `<option value="${esc(p.id)}">${esc(p.name ?? p.id)}</option>`).join('') : `<option value="" disabled>No MIDI ${kind === 'inputs' ? 'inputs' : 'outputs'} found</option>`);
    if ([...select.options].some((o) => o.value === current && !o.disabled)) select.value = current;
    else if (!opts.none && ports.length) select.value = ports[0].id;
    select.disabled = false;
    opts.onChange?.();
  };
  access.addEventListener('statechange', fill);
  fill();
  return () => map.get(select.value);
}
