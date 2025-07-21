import Convert from 'ansi-to-html';

/**
 * Converts an ANSI-formatted console message to safe HTML.
 * - Removes ANSI codes
 * - Converts ANSI styles to HTML
 * - Replaces line breaks with `<br>`
 *
 * @param text - The raw ANSI string
 * @returns HTML-formatted string
 */
export function formatAnsiMessageToHtml(text: string): string {
  if (!text) return 'No message available';

  const converter = new Convert();
  const htmlText = converter.toHtml(text);
  return htmlText.replace(/\n/g, '<br>');
}

export function formatDuration(start: number, stop: number): string {
  const seconds = Math.floor((stop - start) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
