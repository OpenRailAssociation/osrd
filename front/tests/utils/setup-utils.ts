import { expect } from '@playwright/test';

import type {
  Infra,
  LightRollingStock,
  TrainSchedule,
  PostInfraRailjsonApiResponse,
  Project,
  RailJson,
  StdcmSearchEnvironmentCreateForm,
  Study,
} from 'common/api/osrdEditoastApi';

import { E2E_USERS } from '../assets/constants/permission-const';
import {
  dualModeRollingStockName,
  electricRollingStockName,
  fastRollingStockName,
  globalProjectName,
  globalStudyName,
  improbableRollingStockName,
  infrastructureName,
  slowRollingStockName,
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from '../assets/constants/project-const';
import { PROJECT_DATA } from '../assets/operation-studies/project-const';
import { STUDY_DATA } from '../assets/operation-studies/study-const';
import { logger } from '../logging-fixture';
import {
  getApiRequest,
  getInfra,
  listApiRequest,
  retrieveLatestStdcmEnvironment,
  postApiRequest,
  createStdcmEnvironment,
} from './api-utils';
import { addGrants, findUserSubjectId } from './authz-utils';
import { createDateInSpecialTimeZone } from './date-utils';
import { readJsonFile } from './file-utils';
import createScenario from './scenario';
import sendTrains from './send-trains';

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
      ...PROJECT_DATA,
      name: projectName,
      budget: 1234567890,
    },
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
    `/api/studies`,
    {
      ...STUDY_DATA,
      project_id: projectId,
      name: studyName,
      budget: 1234567890,
    },
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
  const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

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

    // Step 6: Create a project, study, scenario and import unique train and paced train data
    const projectWithTrainSchedules = await createProject(trainScheduleProjectName);
    const studyWithTrainSchedules = await createStudy(
      projectWithTrainSchedules.id,
      trainScheduleStudyName
    );
    const { trainScheduleSet, timetableResult } = await createScenario(
      trainScheduleScenarioName,
      projectWithTrainSchedules.id,
      studyWithTrainSchedules.id,
      mediumInfra.id
    );
    const timetableId = timetableResult.timetable_id;
    await sendTrains(trainScheduleSet.id, trains, timetableId);

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
      timetable_id: timetableId,
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

    // Step 8: Grant the STDCM infrastructure and the rolling stocks to the STDCM only e2e user.
    // Skipped when the e2e users haven't been created, so that only the permission tests fail
    if ((await findUserSubjectId(E2E_USERS.stdcmOnly)) === undefined) {
      logger.warn(
        `User "${E2E_USERS.stdcmOnly.identity}" not found, skipping its grants: ` +
          'run scripts/load-e2e-users.sh before running the permission tests'
      );
    } else {
      const allRollingStocks: LightRollingStock[] = await listApiRequest(
        '/api/light_rolling_stock'
      );
      await addGrants('infra', mediumInfra.id, [
        { subject: E2E_USERS.stdcmOnly, grant: 'RESTRICTED_READER' },
      ]);
      await addGrants(
        'rolling_stock',
        allRollingStocks.map(({ id }) => id),
        [{ subject: E2E_USERS.stdcmOnly, grant: 'READER' }]
      );
    }
  } catch (error) {
    throw new Error('Error during test data setup', { cause: error });
  }
}
