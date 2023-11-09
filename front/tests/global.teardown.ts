import { execSync } from 'child_process';
import { test as setup } from '@playwright/test';
import { deleteApiRequest, getSmallInfra } from './assets/utils';

setup('teardown (enabled)', async () => {
  const stdout = execSync(
    'echo "{}" | tee tests/assets/small_infra/infra.json && rm tests/assets/small_infra/external_generated_inputs.json && rm tests/assets/small_infra/simulation.json'
  );
  console.log(stdout.toString());
  await deleteApiRequest(`/infra/${getSmallInfra().id}/`);
});
