import Convert from 'ansi-to-html';
import stripAnsi from 'strip-ansi';

/**
 * Converts an ANSI-formatted console message to safe HTML.
 * - Removes ANSI codes
 * - Converts ANSI styles to HTML
 * - Replaces line breaks with `<br>`
 *
 * @param text - The raw ANSI string
 * @returns HTML-formatted string
 */
export default function formatAnsiMessageToHtml(text: string): string {
  if (!text) return 'No message available';

  const converter = new Convert();
  const cleanText = stripAnsi(text);
  const htmlText = converter.toHtml(cleanText);

  return htmlText.replace(/\n/g, '<br>');
}
