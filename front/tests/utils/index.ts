import fs from 'fs';

import { type Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Fill and check input by ID
// Note: This method check if the locator uses ID or TestID and fills it with the input value
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

// Verify input by ID
// Note: This method check if the locator uses ID or TestID and verifies its content
export async function verifyAndCheckInputById(
  page: Page,
  inputId: string,
  expectedValue: string | number,
  isTestId = false
) {
  const input = isTestId ? page.getByTestId(inputId) : page.locator(`#${inputId}`);

  expect(await input.inputValue()).toContain(`${expectedValue}`);
}

// Generate unique name (used for creating rolling stock)
export const generateUniqueName = async (baseName: string) => {
  // Generate a UUID and truncate it to 6 characters
  const uuidSegment = uuidv4().slice(0, 6);
  return `${baseName}-${uuidSegment}`;
};

// Extracts the first sequence of digits found in the input string and returns it as a number or return 0 if no digits found
export async function extractNumberFromString(input: string): Promise<number> {
  const match = input.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}
// Utility function to read JSON files
export const readJsonFile = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
