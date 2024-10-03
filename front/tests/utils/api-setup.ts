import { request, type APIResponse } from '@playwright/test';

import type { Project, Study, RollingStock, Infra, Scenario } from 'common/api/osrdEditoastApi';

export const getApiContext = async () =>
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

// Helper function to handle API error responses
export function handleErrorResponse(response: APIResponse, errorMessage = 'API Request Failed') {
  if (response.ok()) return;

  throw new Error(`${errorMessage}: ${response.status()} ${response.statusText()}`);
}

export const postApiRequest = async <T>(
  url: string,
  data?: T,
  params?: { [key: string]: string | number | boolean },
  errorMessage?: string
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.post(url, { data, params });
  handleErrorResponse(response, errorMessage);
  return response.json();
};

export const deleteApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const response = await apiContext.delete(url);
  return response;
};

// API calls for beforeAll setup in tests

const findOneInResults = <T extends { name: string }>(results: T[], name: string) =>
  results.find((result) => result.name.includes(name));

export const getInfra = async (infraName: string) => {
  const { results } = await getApiRequest(`/api/infra/`);
  const infra = findOneInResults(results, infraName) as Infra;
  return infra;
};

export const getProject = async (projectName: string) => {
  const { results } = await getApiRequest(`/api/projects/`);
  const project = findOneInResults(results, projectName) as Project;
  return project;
};

export const getStudy = async (projectId: number, studyName: string) => {
  const { results } = await getApiRequest(`/api/projects/${projectId}/studies/`);
  const study = findOneInResults(results, studyName) as Study;
  return study;
};

export const getScenario = async (projectId: number, studyId: number, scenarioName: string) => {
  const { results } = await getApiRequest(
    `/api/projects/${projectId}/studies/${studyId}/scenarios/`
  );
  const scenario = findOneInResults(results, scenarioName) as Scenario;
  return scenario;
};

export const getRollingStock = async (rollingStockName: string) => {
  const { results } = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });
  const rollingStock = findOneInResults(results, rollingStockName) as RollingStock;
  return rollingStock;
};
