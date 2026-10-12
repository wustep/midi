/**
 * Copy buttons, one behavior everywhere: the label flips to "Copied" (or "Copy failed") for 1.5 s,
 * data-state drives the color, the button keeps its width so the row doesn't jump, and a polite live
 * region announces the result for screen readers.
 */
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
  const label = btn.textContent ?? 'Copy';
  let timer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener('click', async () => {
    btn.style.minWidth = `${btn.offsetWidth}px`;
    let ok = true;
    try {
      await navigator.clipboard.writeText(getText());
    } catch {
      ok = false;
    }
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    btn.dataset.state = ok ? 'copied' : 'failed';
    announce(ok ? 'Copied to clipboard' : 'Copy failed');
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.textContent = label;
      delete btn.dataset.state;
    }, 1500);
  });
}
