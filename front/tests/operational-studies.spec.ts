import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import PlaywrightRollingstockModalPage from './rollingstock-modal-model';
import VARIABLES from './assets/operationStudies/test_variables';

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  let playwrightHomePage: PlaywrightHomePage;

  test.beforeEach(async ({ page }) => {
    playwrightHomePage = new PlaywrightHomePage(page);
    await playwrightHomePage.goToHomePage();

    // Real click on project, study, scenario
    await playwrightHomePage.goToOperationalStudiesPage();
    await playwrightHomePage.page
      .getByTestId('_@Test integration project')
      .locator('div')
      .getByRole('button')
      .click();
    await playwrightHomePage.page
      .getByTestId('_@Test integration study')
      .getByRole('button')
      .click();
    await playwrightHomePage.page
      .getByTestId('_@Test integration scenario')
      .getByRole('button')
      .click();

    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();
  });

  test('RollingStockSelector is displayed', async () => {
    expect(playwrightHomePage.page.getByTestId('rollingstock-selector')).not.toEqual(null);
  });

  test('SpeedLimitSelector is displayed', async () => {
    expect(playwrightHomePage.page.getByTestId('speed-limit-by-tag-selector')).not.toEqual(null);
  });

  test('Itinerary module and subcomponents are displayed', async () => {
    // Here is how to create a locator for a specific element
    const itinerary = playwrightHomePage.page.getByTestId('itinerary');
    expect(itinerary).not.toEqual(null);
    // here is how get locator inside another locator
    expect(itinerary.getByTestId('display-itinerary')).not.toEqual(null);
    // here is how you can chain locators
    expect(itinerary.getByTestId('display-itinerary').getByTestId('itinerary-origin')).not.toEqual(
      null
    );
    expect(itinerary.getByTestId('display-itinerary').getByTestId('itinerary-vias')).not.toEqual(
      null
    );
    expect(
      itinerary.getByTestId('display-itinerary').getByTestId('itinerary-destination')
    ).not.toEqual(null);
  });

  test('TrainLabels is displayed', async () => {
    expect(playwrightHomePage.page.getByTestId('add-train-labels')).not.toEqual(null);
  });

  test('TrainSchedules is displayed', async () => {
    expect(playwrightHomePage.page.getByTestId('add-train-schedules')).not.toEqual(null);
  });

  test('Map module is displayed', async () => {
    expect(playwrightHomePage.page.getByTestId('map')).not.toEqual(null);
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
      await playwrightRollingstockModalPage.getRollingstockMiniCardInfos().first().textContent()
    ).toMatch(VARIABLES.rollingstockInfos);
    expect(
      await playwrightRollingstockModalPage.getRollingstockInfosComfort().textContent()
    ).toMatch(/ConfortSStandard/i);
  });
});
