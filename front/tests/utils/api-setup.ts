import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type {
  Project,
  Study,
  RollingStock,
  Infra,
  Scenario,
  ElectricalProfileSet,
} from 'common/api/osrdEditoastApi';

import electricalProfileSet from '../assets/operationStudies/simulationSettings/electricalProfiles/electricalProfile.json';

/**
 * Initializes a new API request context with the base URL.
 *
 * @returns {Promise<APIRequestContext>} - The API request context.
 */
export const getApiContext = async (): Promise<APIRequestContext> =>
  request.newContext({
    baseURL: 'http://localhost:4000',
  });

/**
 * Sends a GET request to the specified API endpoint with optional query parameters.
 *
 * @param {string} url - The API endpoint URL.
 * @param {object} [params] - Optional query parameters to include in the request.
 */
export const getApiRequest = async (
  url: string,
  params?: { [key: string]: string | number | boolean }
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.get(url, { params });
  return response.json();
};

/**
 * Handles API error responses by checking the status and throwing an error if the request failed.
 *
 * @param {APIResponse} response - The response object from the API request.
 * @param {string} [errorMessage='API Request Failed'] - Optional. The error message to throw if the request fails.
 * @throws {Error} - Throws an error if the response status is not OK.
 */
export function handleErrorResponse(
  response: APIResponse,
  errorMessage: string = 'API Request Failed'
) {
  if (response.ok()) return;

  throw new Error(`${errorMessage}: ${response.status()} ${response.statusText()}`);
}

/**
 * Sends a POST request to the specified API endpoint with optional data and query parameters.
 *
 * @template T
 * @param {string} url - The API endpoint URL.
 * @param {T} [data] - Optional. The payload to send in the request body.
 * @param {object} [params] - Optional query parameters to include in the request.
 * @param {string} [errorMessage] - Optional. Custom error message for failed requests.
 */
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

/**
 * Sends a DELETE request to the specified API endpoint.
 *
 * @param {string} url - The API endpoint URL.
 * @returns {Promise<APIResponse>} - The response from the API.
 */
export const deleteApiRequest = async (
  url: string,
  errorMessage?: string
): Promise<APIResponse> => {
  const apiContext = await getApiContext();
  const response = await apiContext.delete(url);
  handleErrorResponse(response, errorMessage);
  return response;
};

/**
 * Finds an item in a list of results by matching the name property.
 *
 * @template T
 * @param {T[]} results - The list of results to search through.
 * @param {string} name - The name to search for in the results.
 * @returns {T | undefined} - The matched result or undefined if not found.
 */
const findOneInResults = <T extends { name: string }>(results: T[], name: string): T | undefined =>
  results.find((result) => result.name.includes(name));

/**
 * Retrieves infrastructure data by name.
 *
 * @param {string} infraName - The name of the infrastructure to retrieve.
 * @returns {Promise<Infra>} - The matching infrastructure data.
 */
export const getInfra = async (infraName: string = 'small_infra_test_e2e'): Promise<Infra> => {
  const { results } = await getApiRequest(`/api/infra/`);
  const infra = findOneInResults(results, infraName) as Infra;
  return infra;
};

/**
 * Retrieves project data by name.
 *
 * @param {string} projectName - The name of the project to retrieve.
 * @returns {Promise<Project>} - The matching project data.
 */
export const getProject = async (projectName: string = 'project_test_e2e'): Promise<Project> => {
  const { results } = await getApiRequest(`/api/projects/`);
  const project = findOneInResults(results, projectName) as Project;
  return project;
};

/**
 * Retrieves study data by project ID and study name.
 *
 * @param {number} projectId - The ID of the project.
 * @param {string} studyName - The name of the study to retrieve.
 * @returns {Promise<Study>} - The matching study data.
 */
export const getStudy = async (
  projectId: number,
  studyName: string = 'study_test_e2e'
): Promise<Study> => {
  const { results } = await getApiRequest(`/api/projects/${projectId}/studies/`);
  const study = findOneInResults(results, studyName) as Study;
  return study;
};

/**
 * Retrieves scenario data by project ID, study ID, and scenario name.
 *
 * @param {number} projectId - The ID of the project.
 * @param {number} studyId - The ID of the study.
 * @param {string} scenarioName - The name of the scenario to retrieve.
 * @returns {Promise<Scenario>} - The matching scenario data.
 */
export const getScenario = async (
  projectId: number,
  studyId: number,
  scenarioName: string
): Promise<Scenario> => {
  const { results } = await getApiRequest(
    `/api/projects/${projectId}/studies/${studyId}/scenarios/`
  );
  const scenario = findOneInResults(results, scenarioName) as Scenario;
  return scenario;
};

/**
 * Retrieves rolling stock data by name.
 *
 * @param {string} rollingStockName - The name of the rolling stock to retrieve.
 * @returns {Promise<RollingStock>} - The matching rolling stock data.
 */
export const getRollingStock = async (rollingStockName: string): Promise<RollingStock> => {
  const { results } = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });
  const rollingStock = findOneInResults(results, rollingStockName) as RollingStock;
  return rollingStock;
};

/**
 * Retrieves electrical profile data by name.
 *
 * @param {string}  electricalProfileName - The name of the electrical profile  to retrieve.
 * @returns {Promise<ElectricalProfileSet>} - The matching electrical profile  data.
 */
export const getElectricalProfile = async (
  electricalProfileName: string
): Promise<ElectricalProfileSet> => {
  const { results } = await getApiRequest(`/api/electrical_profile_set/`);
  const electricalProfile = findOneInResults(
    results,
    electricalProfileName
  ) as ElectricalProfileSet;
  return electricalProfile;
};

/**
 * Sets a new electrical profile.
 */
export const setElectricalProfile = async (): Promise<ElectricalProfileSet> => {
  const electricalProfile = await postApiRequest(
    `/api/electrical_profile_set`,
    {
      ...electricalProfileSet,
    },
    { name: `small infra ${uuidv4()}` }
  );
  return electricalProfile as ElectricalProfileSet;
};
