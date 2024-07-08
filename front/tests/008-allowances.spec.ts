import { test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import ScenarioPage from './pages/scenario-page-model';
import createCompleteScenario, { allowancesManagement } from './utils/scenario-utils';

let scenarioName: string;
let scenarioPage: ScenarioPage;

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  test.beforeEach(async ({ page }) => {
    scenarioPage = new ScenarioPage(page);
    scenarioName = `Train_Schedule_${uuidv4().slice(0, 5)}`;
    await createCompleteScenario(page, scenarioName, '1', '15');
  });

  // ***************** Test apply allowances *****************

  test('Testing standard allowances', async () => {
    await allowancesManagement(scenarioPage, scenarioName, 'standard');
  });

  test('Testing engineering allowances', async () => {
    await allowancesManagement(scenarioPage, scenarioName, 'engineering');
  });
});
