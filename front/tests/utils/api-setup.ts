import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type {
  ElectricalProfileSet,
  GetProjectsApiResponse,
  GetProjectsByProjectIdStudiesApiResponse,
  GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
  GetLightRollingStockApiResponse,
  LightElectricalProfileSet,
  GetInfraApiResponse,
  InfraWithState,
  ProjectWithStudies,
  StudyWithScenarios,
  ScenarioWithDetails,
  LightRollingStockWithLiveries,
  Project,
  Infra,
  Study,
  Scenario,
  LightRollingStock,
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
 * Retrieves infrastructure data by name.
 *
 * @param {string} infraName - The name of the infrastructure to retrieve.
 * @returns {Promise<Infra>} - The matching infrastructure data.
 */
export const getInfra = async (infraName: string = 'small_infra_test_e2e'): Promise<Infra> => {
  const infras: GetInfraApiResponse = await getApiRequest('/api/infra/');
  const infra = infras.results.find((i: InfraWithState) => i.name === infraName);
  return infra as Infra;
};

/**
 * Retrieves project data by name.
 *
 * @param {string} projectName - The name of the project to retrieve.
 * @returns {Promise<Project>} - The matching project data.
 */
export const getProject = async (projectName: string = 'project_test_e2e'): Promise<Project> => {
  const projects: GetProjectsApiResponse = await getApiRequest('/api/projects/');
  const project = projects.results.find((p: ProjectWithStudies) => p.name === projectName);
  return project as Project;
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
  const studies: GetProjectsByProjectIdStudiesApiResponse = await getApiRequest(
    `/api/projects/${projectId}/studies/`
  );
  const study = studies.results.find((s: StudyWithScenarios) => s.name === studyName);
  return study as Study;
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
  const scenarios: GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
    await getApiRequest(`/api/projects/${projectId}/studies/${studyId}/scenarios`);
  const scenario = scenarios.results.find((s: ScenarioWithDetails) => s.name === scenarioName);
  return scenario as Scenario;
};

/**
 * Retrieves rolling stock data by name.
 *
 * @param {string} rollingStockName - The name of the rolling stock to retrieve.
 * @returns {Promise<RollingStock>} - The matching rolling stock data.
 */
export const getRollingStock = async (rollingStockName: string): Promise<LightRollingStock> => {
  const rollingStocks: GetLightRollingStockApiResponse = await getApiRequest(
    '/api/light_rolling_stock/',
    { page_size: 500 }
  );
  const rollingStock = rollingStocks.results.find(
    (r: LightRollingStockWithLiveries) => r.name === rollingStockName
  );
  return rollingStock as LightRollingStock;
};

/**
 * Retrieves electrical profile data by name.
 *
 * @param {string}  electricalProfileName - The name of the electrical profile  to retrieve.
 * @returns {Promise<ElectricalProfileSet>} - The matching electrical profile  data.
 */
export const getElectricalProfile = async (
  electricalProfileName: string
): Promise<LightElectricalProfileSet> => {
  const electricalProfiles: LightElectricalProfileSet[] = await getApiRequest(
    `/api/electrical_profile_set/`
  );
  const electricalProfile = electricalProfiles.find(
    (e: LightElectricalProfileSet) => e.name === electricalProfileName
  );
  return electricalProfile as LightElectricalProfileSet;
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
