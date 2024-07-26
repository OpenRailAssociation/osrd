import { test, expect } from '@playwright/test';

import project from './assets/operationStudies/project.json';
import scenario from './assets/operationStudies/scenario.json';
import study from './assets/operationStudies/study.json';
import HomePage from './pages/home-page-model';
import StdcmPage from './pages/stdcm-page-model';
import manageTrainScheduleTranslation from '../public/locales/fr/operationalStudies/manageTrainSchedule.json';

const projectName = project.name;
const studyName = study.name;
const scenarioName = scenario.name;
const rollingStockName = 'rollingstock_1500_25000_test_e2e';

const emptyRouteTranslation = manageTrainScheduleTranslation.pathfindingNoState;

test.describe('STDCM page', () => {
  test('should configure and launch a stdcm', async ({ page }) => {
    const stdcmPage = new StdcmPage(page);

    // TODO: DROP STDCMV1: remove this part
    const homePage = new HomePage(page);
    await homePage.goToHomePage();
    await homePage.toggleStdcmV1();

    await stdcmPage.navigateToPage();
    await expect(stdcmPage.scenarioExplorerModal).not.toBeVisible();
    await expect(stdcmPage.rollingStockSelectorModal).not.toBeVisible();

    // Open the scenario explorer and select project, study and scenario
    await stdcmPage.openScenarioExplorer();
    await stdcmPage.selectMiniCard(projectName);
    await stdcmPage.selectMiniCard(studyName);
    await stdcmPage.selectMiniCard(scenarioName);

    // Check no route is selected
    await expect(stdcmPage.pathfindingNoState).toContainText(emptyRouteTranslation);

    // Select a rolling stock
    await stdcmPage.openRollingstockModal();
    await expect(stdcmPage.rollingStockSelectorModal).toBeVisible();
    await stdcmPage.selectRollingStock(rollingStockName);

    // Check that the rollingstock is selected
    await expect(stdcmPage.rollingStockSelectorModal).not.toBeVisible();

    await stdcmPage.selectPathByTrigram('MWS', 'NES');
    await stdcmPage.checkPathfindingDistance('34.000 km');

    await stdcmPage.setOriginTime('081500');
    await stdcmPage.clickBtnByName('Appliquer');
    await stdcmPage.page.waitForSelector('.chart-container');
  });
});
