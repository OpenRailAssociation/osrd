import fs from 'fs';

import { type Locator, type Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fills the input field identified by ID or TestID with the specified value and verifies it.
 *
 * @param {Page} page - The Playwright page object.
 * @param {string} inputId - The ID or TestID of the input field.
 * @param {string | number} value - The value to fill into the input field.
 * @param {boolean} [isTestId=false] - Optional. If true, uses TestID instead of ID for locating the input field.
 */
export async function fillAndCheckInputById(
  page: Page,
  inputId: string,
  value: string | number,
  isTestId = false
) {
  const input = isTestId ? page.getByTestId(inputId) : page.locator(`#${inputId}`);

  await input.click();
  await input.fill(`${value}`);
  expect(await input.inputValue()).toBe(`${value}`);
}

/**
 * Verifies the content of the input field identified by ID or TestID.
 *
 * @param {Page} page - The Playwright page object.
 * @param {string} inputId - The ID or TestID of the input field.
 * @param {string | number} expectedValue - The expected value to verify in the input field.
 * @param {boolean} [isTestId=false] - Optional. If true, uses TestID instead of ID for locating the input field.
 */
export async function verifyAndCheckInputById(
  page: Page,
  inputId: string,
  expectedValue: string | number,
  isTestId = false
) {
  const input = isTestId ? page.getByTestId(inputId) : page.locator(`#${inputId}`);

  expect(await input.inputValue()).toContain(`${expectedValue}`);
}

/**
 * Generates a unique name by appending a truncated UUID to the base name.
 *
 * @param {string} baseName - The base name to append the UUID segment to.
 * @returns {string} - The generated unique name.
 */
export const generateUniqueName = (baseName: string): string => {
  const uuidSegment = uuidv4().slice(0, 6);
  return `${baseName}-${uuidSegment}`;
};

/**
 * Extracts the first sequence of digits found in a string and returns it as a number.
 * Returns 0 if no digits are found.
 *
 * @param {string} input - The string to extract the number from.
 * @returns {Promise<number>} - The extracted number or 0 if none found.
 */
export async function extractNumberFromString(input: string): Promise<number> {
  const match = input.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Reads a JSON file from the specified path and returns its parsed content.
 *
 * @param {string} path - The file path of the JSON file.
 * @returns {any} - The parsed JSON content.
 */
export const readJsonFile = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));

/**
 * Clicks on the specified element and waits for a specified delay after the click.
 *
 * @param {Locator} element - locator object representing the element to click.
 * @param {number} [delay=500] - Optional. The delay in milliseconds to wait after clicking the element. Defaults to 500ms.
 *
 * @returns {Promise<void>} - A promise that resolves after the element is clicked and the delay has passed.
 */
export async function clickWithDelay(element: Locator, delay: number = 500): Promise<void> {
  await element.click();
  await element.page().waitForTimeout(delay);
}

/**
 * Converts a date string from YYYY-MM-DD format to "DD mmm YYYY" format.
 * @param dateString - The input date string in YYYY-MM-DD format.
 * @returns The formatted date string in "DD mmm YYYY" format.
 */
export function formatDateToDayMonthYear(dateString: string): string {
  const date = new Date(dateString);

  // Format the date to "15 Oct 2024" using toLocaleDateString
  const formattedDate = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Convert the short month (first letter capitalized) to lowercase
  return formattedDate.replace(/([A-Z])/g, (match) => match.toLowerCase());
}
