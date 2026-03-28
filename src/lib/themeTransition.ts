/**
 * Wraps a DOM update in `document.startViewTransition` when available so the
 * browser can animate between theme snapshots (smooth cross-fade).
 */
export function startThemeTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(update);
  } else {
    update();
  }
}
