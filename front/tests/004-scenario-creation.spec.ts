import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './pages/home-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import scenario from './assets/operationStudies/scenario.json';

import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';
import ScenarioPage from './pages/scenario-page-model';
import VARIABLES from './assets/operationStudies/test_variables';
import PlaywrightCommonPage from './pages/common-page-model';

test.describe('Test is operationnal study : scenario creation workflow is working properly', () => {
  test('Create a new scenario', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);
    const scenarioPage = new ScenarioPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(project.name);
    await studyPage.openStudyByTestId(study.name);

    expect(scenarioPage.getAddScenarioBtn).toBeVisible();
    await scenarioPage.openScenarioCreationModal();
    await scenarioPage.setScenarioName(scenario.name);
    await scenarioPage.setScenarioDescription(scenario.description);

    // Infra created by CI has no electrical profile
    if (!process.env.CI) {
      await scenarioPage.setSenarioElectricProfileByName(VARIABLES.infraName);
    }

    await commonPage.setTag(scenario.tags[0]);
    await commonPage.setTag(scenario.tags[1]);
    await commonPage.setTag(scenario.tags[2]);

    await scenarioPage.setSenarioInfraByName(VARIABLES.infraName);
    const createButton = playwrightHomePage.page.getByText('Créer le scénario');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/scenario');
    expect(await scenarioPage.getScenarioName.textContent()).toContain(scenario.name);
    expect(await scenarioPage.getScenarioDescription.textContent()).toContain(scenario.description);
    expect(await scenarioPage.getScenarioInfraName.textContent()).toContain(VARIABLES.infraName);
  });
});
