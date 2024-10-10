import type {
  Infra,
  PostInfraRailjsonApiResponse,
  Project,
  ProjectCreateForm,
  RailJson,
  Study,
  StudyCreateForm,
} from 'common/api/osrdEditoastApi';

import { readJsonFile } from '.';
import { getApiRequest, postApiRequest } from './api-setup';
import createScenario from './scenario';
import projectData from '../assets/operationStudies/project.json';
import studyData from '../assets/operationStudies/study.json';

/**
 * Helper function to create infrastructure using RailJson.
 *
 * @param {string} [infraName='small_infra_test_e2e'] - The name of the infrastructure to create.
 * @returns {Promise<Infra>} - The created infrastructure object.
 */
async function createInfrastructure(infraName: string = 'small_infra_test_e2e'): Promise<Infra> {
  const smallInfraRailjson: RailJson = readJsonFile('./tests/assets/infra/infra.json');

  const createdInfra: PostInfraRailjsonApiResponse = await postApiRequest(
    `/api/infra/railjson/`,
    { ...smallInfraRailjson },
    {
      name: infraName,
      generate_data: true,
    },
    'Failed to create infrastructure'
  );

  // Fetch and return the created infrastructure by its ID
  const smallInfra: Infra = await getApiRequest(`/api/infra/${createdInfra.infra}`);
  return smallInfra;
}

/**
 * Helper function to create rolling stocks in parallel.
 * Creates multiple rolling stock entries by posting to the API.
 */
async function createRollingStocks(): Promise<void> {
  const rollingStocks = [
    {
      json: readJsonFile('./../tests/data/rolling_stocks/electric_rolling_stock.json'),
      name: 'electric_rolling_stock_test_e2e',
    },
    {
      json: readJsonFile('./tests/assets/rollingStock/slow_rolling_stock.json'),
      name: 'slow_rolling_stock_test_e2e',
    },
    {
      json: readJsonFile('./tests/assets/rollingStock/dual-mode_rolling_stock.json'),
      name: 'dual-mode_rolling_stock_test_e2e',
    },
    {
      json: readJsonFile('./tests/assets/rollingStock/fast_rolling_stock.json'),
      name: 'fast_rolling_stock_test_e2e',
    },
    {
      json: readJsonFile('./tests/assets/rollingStock/improbable_rolling_stock.json'),
      name: 'improbable_rolling_stock_test_e2e',
    },
  ];

  // Post each rolling stock in parallel
  await Promise.all(
    rollingStocks.map(({ json, name }) =>
      postApiRequest(
        '/api/rolling_stock/',
        { ...json, name },
        undefined,
        'Failed to create rolling stocks'
      )
    )
  );
}

/**
 * Helper function to create a project.
 *
 * @param {string} [projectName='project_test_e2e'] - The name of the project to create.
 * @returns {Promise<Project>} - The created project object.
 */
export async function createProject(projectName: string = 'project_test_e2e'): Promise<Project> {
  const project: Project = await postApiRequest(
    '/api/projects/',
    {
      ...projectData,
      name: projectName,
      budget: 1234567890,
    } as ProjectCreateForm,
    undefined,
    'Failed to create project'
  );

  return project;
}

/**
 * Helper function to create a study for a given project.
 *
 * @param {number} projectId - The ID of the project under which the study will be created.
 * @param {string} [studyName='study_test_e2e'] - The name of the study to create.
 * @returns {Promise<Study>} - The created study object.
 */
export async function createStudy(
  projectId: number,
  studyName: string = 'study_test_e2e'
): Promise<Study> {
  const study: Study = await postApiRequest(
    `/api/projects/${projectId}/studies`,
    {
      ...studyData,
      name: studyName,
      budget: 1234567890,
    } as StudyCreateForm,
    undefined,
    'Failed to create study'
  );

  return study;
}

/**
 * Main function to create all necessary test data including infrastructure, rolling stocks,
 * project, study, and scenario.
 */
export async function createDataForTests(): Promise<void> {
  try {
    // Step 1: Create infrastructure
    const smallInfra = await createInfrastructure();

    // Step 2: Create rolling stocks
    await createRollingStocks();

    // Step 3: Create a project
    const project = await createProject();

    // Step 4: Create a study under the project
    const study = await createStudy(project.id);

    // Step 5: Create a scenario for the study
    await createScenario(project.id, study.id, smallInfra.id);

    console.info('Test data setup completed successfully.');
  } catch (error) {
    console.error('Error during test data setup:', error);
  }
}
