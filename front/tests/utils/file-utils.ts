import fs from 'fs';
import path from 'path';

import { expect, type Download, type Locator, type Page } from '@playwright/test';

/**
 * Read a JSON file from the specified path and returns its parsed content.
 *
 * @template T - Type of the object parsed.
 * @param filePath - The file path of the JSON file.
 * @returns {T} - The parsed JSON content.
 */
export function readJsonFile<T extends object>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/**
 * Save a Playwright download into a directory and return the saved file path.
 *
 * @param download - Playwright Download object
 * @param downloadDir - Target directory
 * @returns Absolute path to the saved file
 */
export async function saveDownloadToDir(download: Download, downloadDir: string): Promise<string> {
  await fs.promises.mkdir(downloadDir, { recursive: true });

  const downloadPath = path.join(downloadDir, download.suggestedFilename());
  await download.saveAs(downloadPath);

  return downloadPath;
}

/**
 * Trigger a file download by clicking a locator and wait for the `download` event.
 *
 * @param page - The Playwright `Page` where the download is expected to happen
 * @param locator - Locator that triggers the download when clicked
 * @returns The Playwright `Download` object
 */
export async function triggerFileDownload(page: Page, locator: Locator): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), locator.click()]);

  return download;
}

/**
 * Assert the browser-provided suggested filename matches a pattern.
 *
 * @param download - The Playwright `Download` object
 * @param expected - Expected filename regex pattern
 */
export function assertSuggestedFilename(download: Download, expected: RegExp): void {
  expect(download.suggestedFilename()).toMatch(expected);
}
