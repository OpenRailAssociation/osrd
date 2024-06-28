import fs from 'fs';

import { test as setup } from '@playwright/test';

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
import { getApiRequest, postApiRequest } from './utils/index';

async function createDataForTests() {
  const smallInfraRailjson: RailJson = JSON.parse(
    fs.readFileSync('../tests/data/infras/small_infra/infra.json', 'utf8')
  );

  const rollingStockJson = JSON.parse(
    fs.readFileSync('../tests/data/rolling_stocks/electric_rolling_stock.json', 'utf8')
  );

  const createdInfra: PostInfraRailjsonApiResponse = await postApiRequest(
    `/api/infra/railjson/`,
    {
      ...smallInfraRailjson,
    },
    {
      name: 'small_infra_test_e2e',
      generate_data: true,
    }
  );

  const smallInfra: Infra = await getApiRequest(`/api/infra/${createdInfra.infra}`);

  await postApiRequest('/api/rolling_stock/', {
    ...rollingStockJson,
    name: 'rollingstock_1500_25000_test_e2e',
  });

  const project = await postApiRequest('/api/projects/', {
    ...projectData,
    budget: 1234567890,
  } as ProjectCreateForm);

  const study = await postApiRequest(`/api/projects/${project.id}/studies`, {
    ...studyData,
    budget: 1234567890,
  } as StudyCreateForm);

  await postApiRequest(`/api/projects/${project.id}/studies/${study.id}/scenarios`, {
    ...scenarioData,
    infra_id: smallInfra.id,
  });
}

setup('setup', async () => {
  await createDataForTests();
});
