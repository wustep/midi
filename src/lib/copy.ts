/**
 * Copy buttons, one behavior everywhere: the label flips to "Copied" (or "Copy failed") for 1.5 s and the
 * copy icon becomes a check, data-state drives the color, the button keeps its width so the row doesn't
 * jump, and a polite live region announces the result for screen readers.
 * Markup: <button class="btn btn-sm" data-copy><Icon name="copy" /><span data-label>Copy</span></button>
 */
import { iconSvg } from './icons.mjs';

let live: HTMLElement | undefined;
function announce(msg: string) {
  if (!live) {
    live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    document.body.append(live);
  }
  live.textContent = '';
  requestAnimationFrame(() => (live!.textContent = msg));
}

export function bindCopy(btn: HTMLButtonElement, getText: () => string) {
  const labelEl = btn.querySelector<HTMLElement>('[data-label]') ?? btn;
  const label = labelEl.textContent ?? 'Copy';
  const icon = btn.querySelector('svg');
  const size = Number(icon?.getAttribute('width') ?? 16);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const setIcon = (name: string) => {
    const cur = btn.querySelector('svg');
    if (cur) cur.outerHTML = iconSvg(name, { size });
  };
  btn.addEventListener('click', async () => {
    btn.style.minWidth = `${btn.offsetWidth}px`;
    let ok = true;
    try {
      await navigator.clipboard.writeText(getText());
    } catch {
      ok = false;
    }
    labelEl.textContent = ok ? 'Copied' : 'Copy failed';
    if (ok) setIcon('check');
    btn.dataset.state = ok ? 'copied' : 'failed';
    announce(ok ? 'Copied to clipboard' : 'Copy failed');
    clearTimeout(timer);
    timer = setTimeout(() => {
      labelEl.textContent = label;
      setIcon('copy');
      delete btn.dataset.state;
    }, 1500);
  });
}
