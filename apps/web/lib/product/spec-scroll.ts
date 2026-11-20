export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}

/**
 * True only for a plain left click. Modified and middle clicks keep the
 * link's own behaviour (new tab / new window / download), so the ad page
 * must not intercept them.
 */
export function isPlainLeftClick(event: ClickModifiers): boolean {
  return (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}
