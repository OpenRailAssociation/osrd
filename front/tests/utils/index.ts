// TODO: Dispatch the functions in differents files

import { type Page, request, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type { Project, Scenario, Study, RollingStock, Infra } from 'common/api/osrdEditoastApi';

// API requests

const getApiContext = async () =>
  request.newContext({
    baseURL: 'http://localhost:4000',
  });

export const getApiRequest = async (
  url: string,
  params?: { [key: string]: string | number | boolean }
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.get(url, { params });
  return response.json();
};

export const postApiRequest = async <T>(
  url: string,
  data?: T,
  params?: { [key: string]: string | number | boolean }
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.post(url, { data, params });
  return response.json();
};

export const deleteApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const response = await apiContext.delete(url);
  return response;
};

// API calls for beforeAll setup in tests

export const findOneInResults = <T extends { name: string }>(results: T[], name: string) =>
  results.find((result) => result.name === name);

export const getInfra = async () => {
  const { results } = await getApiRequest(`/api/infra/`);
  const infra = findOneInResults(results, 'small_infra_test_e2e') as Infra;
  return infra;
};

export const getProject = async () => {
  const { results } = await getApiRequest(`/api/projects/`);
  const project = findOneInResults(results, 'project_test_e2e') as Project;
  return project;
};

export const getStudy = async (projectId: number) => {
  const { results } = await getApiRequest(`/api/projects/${projectId}/studies/`);
  const study = findOneInResults(results, 'study_test_e2e') as Study;
  return study;
};

export const getScenario = async (projectId: number, studyId: number) => {
  const { results } = await getApiRequest(
    `/api/projects/${projectId}/studies/${studyId}/scenarios/`
  );
  const scenario = findOneInResults(results, 'scenario_test_e2e') as Scenario;
  return scenario;
};

export const getRollingStock = async () => {
  const { results } = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });
  const rollingStock = findOneInResults(
    results,
    'rollingstock_1500_25000_test_e2e'
  ) as RollingStock;
  return rollingStock;
};
// Add a rolling Stock
export async function addRollingStock(rollingStockName: string, rollingStockJson: JSON) {
  await postApiRequest('/api/rolling_stock/', {
    ...rollingStockJson,
    name: rollingStockName,
  });
}
// Find and delete rolling stock with the given name
export async function findAndDeleteRollingStocks(rollingStockNames: string[]) {
  const rollingStocks = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });

  const deleteRequests = rollingStockNames.map(async (name) => {
    const rollingStockToDelete = rollingStocks.results.find((r: RollingStock) => r.name === name);
    if (rollingStockToDelete) {
      await deleteApiRequest(`/api/rolling_stock/${rollingStockToDelete.id}/`);
    }
  });

  await Promise.all(deleteRequests);
}

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
