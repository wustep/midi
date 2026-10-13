/**
 * MIDI activity, for the LED next to the DIN mark in the header. Like the IN light on a piece of
 * hardware, it blinks when a note plays or a message arrives anywhere on the page.
 */
let last = 0;

/** Report activity. Cheap to call per message: blinks are at most one per 40 ms. */
export function activity() {
  const now = globalThis.performance?.now() ?? 0;
  if (now - last < 40) return;
  last = now;
  globalThis.dispatchEvent?.(new Event('midi:activity'));
}
