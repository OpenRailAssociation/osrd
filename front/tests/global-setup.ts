import { test as setup } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type {
  Infra,
  PostInfraRailjsonApiResponse,
  ProjectCreateForm,
  RailJson,
  StudyCreateForm,
} from 'common/api/osrdEditoastApi';

import projectData from './assets/operationStudies/project.json';
import scenarioData from './assets/operationStudies/scenario.json';
import studyData from './assets/operationStudies/study.json';
import { readJsonFile } from './utils';
import { getApiRequest, postApiRequest } from './utils/api-setup';

async function createDataForTests() {
  const smallInfraRailjson: RailJson = readJsonFile('../tests/data/infras/small_infra/infra.json');

  // Prepare rolling stock data from multiple files
  const rollingStocks = [
    {
      json: readJsonFile('../tests/data/rolling_stocks/electric_rolling_stock.json'),
      name: 'rollingstock_1500_25000_test_e2e',
    },
    {
      json: readJsonFile('../tests/data/rolling_stocks/slow_rolling_stock.json'),
      name: 'slow_rolling_stock_test_e2e',
    },
    {
      json: readJsonFile('./tests/assets/rollingStock/dual-mode_rolling_stock.json'),
      name: 'dual-mode_rollingstock_test_e2e',
    },
    {
      json: readJsonFile('../tests/data/rolling_stocks/fast_rolling_stock.json'),
      name: 'fast_rolling_stock_test_e2e',
    },
  ];

  // Create the small infrastructure using the API
  const createdInfra: PostInfraRailjsonApiResponse = await postApiRequest(
    `/api/infra/railjson/`,
    { ...smallInfraRailjson },
    {
      name: 'small_infra_test_e2e',
      generate_data: true,
    }
  );

  // Fetch the created infrastructure details
  const smallInfra: Infra = await getApiRequest(`/api/infra/${createdInfra.infra}`);

  // Create rolling stocks in parallel
  await Promise.all(
    rollingStocks.map(({ json, name }) => postApiRequest('/api/rolling_stock/', { ...json, name }))
  );

  // Create a project using the project data
  const project = await postApiRequest('/api/projects/', {
    ...projectData,
    budget: 1234567890,
  } as ProjectCreateForm);

  // Create a study under the created project
  const study = await postApiRequest(`/api/projects/${project.id}/studies`, {
    ...studyData,
    budget: 1234567890,
  } as StudyCreateForm);

  // Generate a timetable
  const timetableResult = await postApiRequest(`/api/timetable/`);
  // Create a scenario for the study
  await postApiRequest(`/api/projects/${project.id}/studies/${study.id}/scenarios`, {
    ...scenarioData,
    name: `${scenarioData.name} ${uuidv4()}`,
    study_id: study.id,
    infra_id: smallInfra.id,
    timetable_id: timetableResult.timetable_id,
    electrical_profile_set_id: null,
  });
}

setup('setup', async () => {
  await createDataForTests();
});
