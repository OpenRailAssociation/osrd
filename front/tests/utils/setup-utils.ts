import { expect } from '@playwright/test';

import type {
  Infra,
  PostInfraRailjsonApiResponse,
  Project,
  ProjectCreateForm,
  RailJson,
  StdcmSearchEnvironmentCreateForm,
  Study,
  StudyCreateForm,
} from 'common/api/osrdEditoastApi';

import {
  getApiRequest,
  getInfra,
  retrieveLatestStdcmEnvironment,
  postApiRequest,
  createStdcmEnvironment,
} from './api-utils';
import { createDateInSpecialTimeZone } from './date-utils';
import readJsonFile from './file-utils';
import { sendPacedTrains } from './paced-train';
import createScenario from './scenario';
import sendTrainSchedules from './train-schedule';
import type { ProjectData, StudyData } from './types';
import {
  dualModeRollingStockName,
  electricRollingStockName,
  fastRollingStockName,
  globalProjectName,
  globalStudyName,
  improbableRollingStockName,
  infrastructureName,
  slowRollingStockName,
  timetableItemProjectName,
  timetableItemScenarioName,
  timetableItemStudyName,
} from '../assets/constants/project-const';

const projectData: ProjectData = readJsonFile('tests/assets/operation-studies/project.json');
const studyData: StudyData = readJsonFile('tests/assets/operation-studies/study.json');

/**
 * Helper function to create infrastructure using RailJson.
 *
 * @param infraName - The name of the infrastructure to create.
 * @returns {Promise<Infra>} - The created infrastructure object.
 */
async function createInfrastructure(infraName = infrastructureName): Promise<Infra> {
  const mediumInfraRailjson: RailJson = readJsonFile(
    './../tests/data/infras/medium_infra/infra.json'
  );

  const createdInfra: PostInfraRailjsonApiResponse = await postApiRequest(
    `/api/infra/railjson`,
    { ...mediumInfraRailjson },
    {
      name: infraName,
      generate_data: true,
    },
    'Failed to create infrastructure'
  );

  // Fetch and return the created infrastructure by its ID
  const mediumInfra: Infra = await getApiRequest(`/api/infra/${createdInfra.infra}`);
  return mediumInfra;
}

/**
 * Helper function to create rolling stocks in parallel.
 * Create multiple rolling stock entries by posting to the API.
 */
async function createRollingStocks(): Promise<void> {
  const rollingStocks = [
    {
      json: readJsonFile('./../tests/data/rolling_stocks/electric_rolling_stock.json'),
      name: electricRollingStockName,
    },
    {
      json: readJsonFile('./tests/assets/rolling-stock/slow_rolling_stock.json'),
      name: slowRollingStockName,
    },
    {
      json: readJsonFile('./tests/assets/rolling-stock/dual-mode_rolling_stock.json'),
      name: dualModeRollingStockName,
    },
    {
      json: readJsonFile('./tests/assets/rolling-stock/fast_rolling_stock.json'),
      name: fastRollingStockName,
    },
    {
      json: readJsonFile('./tests/assets/rolling-stock/improbable_rolling_stock.json'),
      name: improbableRollingStockName,
    },
  ];

  // Post each rolling stock in parallel
  await Promise.all(
    rollingStocks.map(({ json, name }) =>
      postApiRequest(
        '/api/rolling_stock',
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
 * @param projectName - The name of the project to create.
 * @returns {Promise<Project>} - The created project object.
 */
export async function createProject(projectName = globalProjectName): Promise<Project> {
  const project: Project = await postApiRequest(
    '/api/projects',
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
 * @param projectId - The ID of the project under which the study will be created.
 * @param studyName - The name of the study to create.
 * @returns {Promise<Study>} - The created study object.
 */
export async function createStudy(projectId: number, studyName = globalStudyName): Promise<Study> {
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
  const trainSchedulesJson: JSON = readJsonFile(
    './tests/assets/train-schedule/train_schedules.json'
  );
  const pacedTrainsJson: JSON = readJsonFile('./tests/assets/paced-train/paced_trains.json');

  try {
    // Step 1: Create infrastructure
    let mediumInfra = await getInfra();
    if (!mediumInfra) mediumInfra = await createInfrastructure();
    process.env.TEST_INFRA_ID = String(mediumInfra.id);

    // Step 2: Create rolling stocks
    await createRollingStocks();

    // Step 3: Create a project
    const project = await createProject();

    // Step 4: Create a study under the project
    const study = await createStudy(project.id);

    // Step 5: Create a scenario for the study
    await createScenario(undefined, project.id, study.id, mediumInfra.id);

    // Step 6: Create a project, study, scenario and import train schedule and paced train data
    const projectWithTimetableItems = await createProject(timetableItemProjectName);
    const studyWithTimetableItems = await createStudy(
      projectWithTimetableItems.id,
      timetableItemStudyName
    );
    const scenarioWithTimetableItems = (
      await createScenario(
        timetableItemScenarioName,
        projectWithTimetableItems.id,
        studyWithTimetableItems.id,
        mediumInfra.id
      )
    ).scenario;
    await sendTrainSchedules(scenarioWithTimetableItems.timetable_id, trainSchedulesJson);
    await sendPacedTrains(scenarioWithTimetableItems.timetable_id, pacedTrainsJson);

    // Step 7: Configure STDCM search environment for the tests
    const stdcmEnvironment = {
      infra_id: mediumInfra.id,
      search_window_begin: createDateInSpecialTimeZone(
        '2024-10-17T00:00:00',
        'Europe/Paris'
      ).toISOString(),
      search_window_end: createDateInSpecialTimeZone(
        '2024-10-18T23:59:59',
        'Europe/Paris'
      ).toISOString(),
      timetable_id: scenarioWithTimetableItems.timetable_id,
      enabled_from: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // one hour ago
      enabled_until: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // in four hours
      speed_limits: {
        speed_limit_tags: {
          MA80: 80,
          MA90: 90,
          MA100: 100,
          ME100: 100,
          ME120: 120,
          ME140: 140,
          HLP: 100,
          MV160: 160,
          MVGV: 200,
        },
        default_speed_limit_tag: 'MA100',
      },
    } as StdcmSearchEnvironmentCreateForm;

    await createStdcmEnvironment(stdcmEnvironment);
    expect(await retrieveLatestStdcmEnvironment()).toMatchObject({
      infra_id: mediumInfra.id,
    });
  } catch (error) {
    throw new Error('Error during test data setup', { cause: error });
  }
}
