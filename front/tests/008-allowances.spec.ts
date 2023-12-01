import { test, expect } from './baseFixtures';
import VARIABLES from './assets/operationStudies/testVariables';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import createCompleteScenario from './assets/utils';

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000); // 2min
    await createCompleteScenario(
      page,
      '_@Test integration scenario',
      'Train Schedule 1',
      '1',
      '15',
      PATH_VARIABLES.originSearch,
      PATH_VARIABLES.destinationSearch,
      VARIABLES.pathfindingDistance
    );
  });

  // ***************** Test apply allowances *****************

  test('Testing allowances', async ({ page }) => {
    const scenarioPage = new PlaywrightScenarioPage(page);

    await expect(scenarioPage.getTimetableList).toBeVisible();

    await scenarioPage.clickBtnByName('Afficher/masquer le détail des trains');

    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();

    await scenarioPage.clickBtnByName('Modifier');

    await scenarioPage.openAllowancesModule();
    await expect(scenarioPage.getAllowancesModule).toBeVisible();

    // Add and check standard allowance
    await scenarioPage.setStandardAllowance();
    await scenarioPage.clickBtnByName('Modifier le train');

    expect(await scenarioPage.isAllowanceWorking()).toEqual(true);

    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();
    await scenarioPage.clickBtnByName('Modifier');
    await scenarioPage.openAllowancesModule();
    await expect(scenarioPage.getAllowancesModule).toBeVisible();

    // Add and check engineering allowance
    await scenarioPage.setEngineeringAllowance();
    await scenarioPage.clickSuccessBtn();
    expect(scenarioPage.checkAllowanceEngineeringBtn());
    await scenarioPage.clickBtnByName('Modifier le train');
    await scenarioPage.page.waitForSelector('.scenario-details-name');

    expect(await scenarioPage.isAllowanceWorking()).toEqual(true);
  });

  // ***************** Deleting train *****************

  test.afterEach(async ({ page }) => {
    const scenarioPage = new PlaywrightScenarioPage(page);
    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();
    await scenarioPage.page.getByRole('button', { name: 'Supprimer' }).click();
  });
});
