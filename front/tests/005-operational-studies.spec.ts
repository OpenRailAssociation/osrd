import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import PlaywrightRollingstockModalPage from './rollingstock-modal-model';
import VARIABLES from './assets/operationStudies/test_variables';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import scenario from './assets/operationStudies/scenario.json';

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  let playwrightHomePage: PlaywrightHomePage;
  let playwrightScenarioPage: PlaywrightScenarioPage;
  let projectPage: ProjectPage;
  let studyPage: StudyPage;

  test.beforeEach(async ({ page }) => {
    playwrightHomePage = new PlaywrightHomePage(page);
    playwrightScenarioPage = new PlaywrightScenarioPage(page);
    projectPage = new ProjectPage(page);
    studyPage = new StudyPage(page);

    await playwrightHomePage.goToHomePage();

    // Real click on project, study, scenario
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(project.name);

    await studyPage.openStudyByTestId(study.name);

    await playwrightScenarioPage.openScenarioByTestId(scenario.name);

    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();
  });

  test('RollingStockSelector is displayed', async () => {
    await expect(playwrightScenarioPage.getRollingStockSelector).toBeVisible();
  });

  test('SpeedLimitSelector is displayed', async () => {
    await playwrightScenarioPage.openTabByText('Paramètres de simulation');
    await expect(playwrightScenarioPage.getSpeedLimitSelector).toBeVisible();
  });

  test('Itinerary module and subcomponents are displayed', async () => {
    await playwrightScenarioPage.openTabByText('Itinéraire');
    // Here is how to create a locator for a specific element
    const itinerary = playwrightScenarioPage.getItineraryModule;
    await expect(itinerary).toBeVisible();
    // here is how get locator inside another locator
    await expect(itinerary.getByTestId('display-itinerary')).toBeVisible();
    // here is how you can chain locators
    await expect(playwrightScenarioPage.getItineraryOrigin).toBeVisible();
    await expect(playwrightScenarioPage.getItineraryVias).toBeVisible();
    await expect(playwrightScenarioPage.getItinenaryDestination).toBeVisible();
  });

  test('Map module is displayed', async () => {
    await playwrightScenarioPage.openTabByText('Itinéraire');
    await expect(playwrightScenarioPage.getMapModule).toBeVisible();
  });

  test('Select rolling stock', async () => {
    const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
      playwrightHomePage.page
    );
    await playwrightRollingstockModalPage.openRollingstockModal();
    const rollingstockModal = playwrightRollingstockModalPage.getRollingstockModal;
    await expect(rollingstockModal).toBeVisible();

    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstock
    );

    await playwrightRollingstockModalPage.getElectricalCheckbox.click();
    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstockWithElectrical
    );

    await playwrightRollingstockModalPage.searchRollingstock(VARIABLES.searchRollingstock);
    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstockWithSearch
    );

    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      VARIABLES.rollingstockTestID
    );
    await expect(rollingstockCard).toHaveClass(/inactive/);
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    await rollingstockCard.locator('button').click();

    expect(
      await playwrightRollingstockModalPage.getRollingStockMiniCardInfo().first().textContent()
    ).toMatch(VARIABLES.rollingStockInfo);
    expect(
      await playwrightRollingstockModalPage.getRollingStockInfoComfort().textContent()
    ).toMatch(/ConfortSStandard/i);
  });

  test('Select composition code', async () => {
    await playwrightScenarioPage.openTabByText('Paramètres de simulation');
    await playwrightScenarioPage.getSpeedLimitSelector.click();
    await playwrightScenarioPage.getSpeedLimitSelector.locator('input').fill('32');
    await playwrightScenarioPage.getSpeedLimitSelector
      .getByRole('button', { name: 'Voyageurs - Automoteurs - E32C' })
      .click();
    expect(await playwrightScenarioPage.getSpeedLimitSelector.textContent()).toMatch(
      /Voyageurs - Automoteurs - E32C/i
    );
  });
});
