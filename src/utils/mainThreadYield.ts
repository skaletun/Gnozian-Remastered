/** Lets the browser paint (e.g. loading overlay) before a long synchronous task. */
export function yieldForPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
