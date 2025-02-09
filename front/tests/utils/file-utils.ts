import fs from 'fs';

/**
 * Read a JSON file from the specified path and returns its parsed content.
 *
 * @template T - Type of the object parsed.
 * @param path - The file path of the JSON file.
 * @returns {T} - The parsed JSON content.
 */
export default function readJsonFile<T extends object>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}
