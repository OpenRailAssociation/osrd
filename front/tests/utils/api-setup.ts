import { request } from '@playwright/test';

import type { Project, Study, RollingStock, Infra, Scenario } from 'common/api/osrdEditoastApi';

import { handleApiResponse } from './index';

// API requests

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

export const postApiRequest = async <T>(
  url: string,
  data?: T,
  params?: { [key: string]: string | number | boolean },
  errorMessage?: string
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.post(url, { data, params });
  if (errorMessage) {
    handleApiResponse(response, errorMessage);
  }
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
