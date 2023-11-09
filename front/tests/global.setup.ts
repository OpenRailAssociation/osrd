import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { getApiRequest, postApiRequest } from './assets/utils';
import VARIABLES from './assets/operationStudies/testVariables';

async function createSmallInfra() {
  const smallInfraRailjson = JSON.parse(
    fs.readFileSync('./tests/assets/small_infra/infra.json', 'utf-8')
  );
  const createdInfra = await postApiRequest(
    `/infra/railjson/`,
    {
      ...smallInfraRailjson,
    },
    {
      name: `${VARIABLES.infraName}_${uuidv4().slice(0, 8)}`,
      generate_data: true,
    }
  );
  const smallInfra = await getApiRequest(`/infra/${createdInfra.infra}`);
  process.env.SMALL_INFRA = JSON.stringify(smallInfra);
}

setup('setup (enabled)', async () => {
  const stdout = execSync(
    'poetry --directory ../python/railjson_generator install && poetry --directory ../python/railjson_generator/ run python -m railjson_generator ./tests/assets/ small_infra'
  );
  console.log(stdout.toString());
  await createSmallInfra();
});
