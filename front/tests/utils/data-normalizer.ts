/**
 * Trim leading/trailing whitespace and replaces multiple spaces with a single space.
 *
 * @param text - The input string to clean.
 * @returns {string} - The cleaned string with normalized whitespace.
 */
export function cleanWhitespace(text: string | null | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Clean whitespace for each string in an array of headers.
 *
 * @param texts - The array of texts strings to clean.
 * @returns {string[]} - The cleaned array of texts.
 */
export function cleanWhitespaceInArray(texts: string[]): string[] {
  return texts.map(cleanWhitespace);
}

/**
 * Remove non-alphanumeric characters from a string.
 *
 * @param text - The input text to clean.
 * @returns {string} - The cleaned text with non-alphanumeric characters removed.
 */
export function cleanText(text: string | null): string {
  return text?.replace(/[^A-Za-z0-9]/g, '') ?? '';
}

/**
 * Remove all whitespace characters from a string.
 *
 * @param text - The input string to clean.
 * @returns {string} - The string with all whitespace removed.
 */
export function removeWhitespace(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, '');
}

/**
 * Return empty string for time input placeholder values ('hh:mm:ss'), otherwise trim.
 */
export function cleanTimeInput(value: string | null | undefined): string {
  if (!value || value === 'hh:mm:ss') return '';
  return value.trim();
}

/**
 * Strip colon separators from a time string so it can be typed digit-by-digit into a time input.
 * e.g. '08:30:00' → '083000'
 */
export function stripTimeColons(time: string): string {
  return time.replaceAll(':', '');
}

/**
 * Escape regex special characters in a string so it can be safely used inside a RegExp.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
