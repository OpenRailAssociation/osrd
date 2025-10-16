import { type Locator, type Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import { getWorkerStatus } from './api-utils';
import { logger } from '../logging-fixture';

/**
 * Fill the input field identified by ID or TestID with the specified value and verifies it.
 *
 * @param  page - The Playwright page object.
 * @param inputId - The ID or TestID of the input field.
 * @param value - The value to fill into the input field.
 * @param isTestId - Optional. If true, uses TestID instead of ID for locating the input field.
 */
export async function fillAndCheckInputById(
  page: Page,
  inputId: string,
  value: string | number,
  isTestId: boolean = false
) {
  const input = isTestId ? page.getByTestId(inputId) : page.locator(`#${inputId}`);

  await input.click();
  await input.fill(`${value}`);
  expect(await input.inputValue()).toBe(`${value}`);
}

/**
 * Verify the content of the input field identified by ID or TestID.
 *
 * @param page - The Playwright page object.
 * @param inputId - The ID or TestID of the input field.
 * @param expectedValue - The expected value to verify in the input field.
 * @param isTestId - Optional. If true, uses TestID instead of ID for locating the input field.
 */
export async function verifyAndCheckInputById(
  page: Page,
  inputId: string,
  expectedValue: string | number,
  isTestId: boolean = false
) {
  const input = isTestId ? page.getByTestId(inputId) : page.locator(`#${inputId}`);

  expect(await input.inputValue()).toContain(`${expectedValue}`);
}

/**
 * Generate a unique name by appending a truncated UUID to the base name.
 *
 * @param baseName - The base name to append the UUID segment to.
 * @returns {string} - The generated unique name.
 */
export const generateUniqueName = (baseName: string): string => {
  const uuidSegment = uuidv4().slice(0, 6);
  return `${baseName}-${uuidSegment}`;
};

/**
 * Extract the first sequence of digits found in a string and returns it as a number.
 * Return 0 if no digits are found.
 *
 * @param input - The string to extract the number from.
 * @returns {Promise<number>} - The extracted number or 0 if none found.
 */
export async function extractNumberFromString(input: string): Promise<number> {
  const match = input.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Generic function to handle input fields.
 *
 * @param {Locator} inputField - The locator for the input field to interact with.
 * @param {string} [value] - The value to input into the field. If not provided, the function will do nothing.
 * @returns {Promise<void>} A promise that resolves once the input field is filled and verified.
 */
export async function handleAndVerifyInput(inputField: Locator, value?: string): Promise<void> {
  if (value) {
    await inputField.click();
    await inputField.fill(value);
    await expect(inputField).toHaveValue(value);
  }
}

/**
 * Waits until the infrastructure state becomes 'CACHED' before proceeding to the next step.
 * The function polls the `workerStatus` every 10 seconds, up to a total of 60 seconds.
 * Displays the total time taken for the state to reach 'CACHED'.
 *
 * @param infraId - The ID of the infrastructure to retrieve and check.
 * @throws {Error} - Throws an error if the state does not become 'CACHED' within 60 seconds.
 * @returns {Promise<void>} - Resolves when the state is 'CACHED'.
 */
export const waitForInfraStateToBeCached = async (infraId: number): Promise<void> => {
  const maxRetries = 6; // Total attempts (60 seconds / 10 seconds)
  const delay = 10000; // Delay in milliseconds (10 seconds)
  const startTime = Date.now(); // Record start time

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const status = await getWorkerStatus(infraId);
    if (status === 'READY') {
      const totalTime = Date.now() - startTime;
      logger.info(
        `Infrastructure state is 'CACHED'. Total time taken: ${totalTime / 1000} seconds.`
      );
      return;
    }
    logger.info(`Attempt ${attempt + 1}: Infrastructure current state is '${status}', waiting...`);
    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  throw new Error("Infrastructure state did not reach 'CACHED' within the allotted 3 minutes.");
};

/**
 * Get trimmed textContent from a locator
 */
export async function getCleanText(locator: Locator): Promise<string> {
  return ((await locator.textContent()) ?? '').trim();
}

/**
 * Check whether the element has the grey text class
 */
export async function isGreyed(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el.classList.contains('text-grey-30'));
}

/**
 * Check whether the element's content vertically overflows
 */
export async function isOverflowing(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el.scrollHeight > el.clientHeight);
}

/**
 * Generic toggle helper for visibility-based UI components.
 * @param button - The locator of the toggle button to click.
 * @param targetLocators - One or multiple locators whose visibility changes when toggled.
 * @param isOpen - Whether the panel is currently open (true) or closed (false).
 */
export async function toggleByState(
  button: Locator,
  targetLocators: Locator | Locator[],
  isOpen: boolean
): Promise<void> {
  const list = Array.isArray(targetLocators) ? targetLocators : [targetLocators];

  await button.click();

  const assertFn = isOpen
    ? (t: Locator) => expect(t).toBeHidden()
    : (t: Locator) => expect(t).toBeVisible();

  await Promise.all(list.map(assertFn));
}
