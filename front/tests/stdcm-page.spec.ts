import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import playwrightDataTest from './playwright-data-test.json';
import { PlaywrightSTDCMPage } from './stdcm-page-model';

// Describe the test suite for the STDCM page
test.describe('STDCM page', () => {
  // Declare the necessary variables for the test suite
  let playwrightHomePage: PlaywrightHomePage;
  let playwrightSTDCMPage: PlaywrightSTDCMPage;

  // This function will run before all the tests in this suite
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Create an instance of the PlaywrightHomePage class
    playwrightHomePage = new PlaywrightHomePage(page);

    // Create an instance of the PlaywrightSTDCMPage class
    playwrightSTDCMPage = new PlaywrightSTDCMPage(page);

    // Go to the home page of OSDR
    await playwrightHomePage.goToHomePage();

    await playwrightHomePage.goToSTDCMPage();

    // Intercept the project request and return data test results
    await playwrightSTDCMPage.page.route('**/projects/*', async (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(playwrightDataTest.project),
      });
    });

    // Intercept the study request and return data test results
    await playwrightSTDCMPage.page.route('**/projects/*/studies/*', async (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(playwrightDataTest.study),
      });
    });

    // Intercept the scenario request and return data test results
    await playwrightSTDCMPage.page.route('**/projects/*/studies/*/scenarios/*', async (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(playwrightDataTest.scenario),
      });
    });

    // Intercept the rollingstock request and return data test results
    await playwrightSTDCMPage.page.route('**/light_rolling_stock/*', async (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(playwrightDataTest.rollingStocks),
      });
    });

    await playwrightSTDCMPage.getScenarioExploratorModalClose();

    // Opens the scenario explorator and selects project, study and scenario
    await playwrightSTDCMPage.openScenarioExplorator();
    await playwrightSTDCMPage.getScenarioExploratorModalOpen();
    await playwrightSTDCMPage.clickItemScenarioExploratorByName(
      playwrightDataTest.project.results[0].name
    );
    await playwrightSTDCMPage.clickItemScenarioExploratorByName(
      playwrightDataTest.study.results[0].name
    );
    await playwrightSTDCMPage.clickItemScenarioExploratorByName(
      playwrightDataTest.scenario.results[0].name
    );
  });

  test('should be correctly displays the rolling stock list', async () => {
    const rollingstocks = playwrightDataTest.rollingStocks.results;
    await playwrightSTDCMPage.getRollingstockModalClose();
    await playwrightSTDCMPage.openRollingstockModal();
    await playwrightSTDCMPage.getRollingstockModalOpen();

    const numberOfRollingstock = await playwrightSTDCMPage.getRollingStockListItem.count();

    expect(numberOfRollingstock).toEqual(rollingstocks.length);

    const infoCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-infos')
      .allTextContents();

    const footerCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-footer')
      .allTextContents();

    rollingstocks.forEach(async (rollingstock) => {
      const { metadata } = rollingstock;

      // Format rollingstock data for test
      const rollingstockSerie = metadata.series || metadata.reference;
      const rollingstockSubserie =
        metadata.series && metadata.series !== metadata.subseries
          ? metadata?.subseries
          : metadata?.detail;
      const infoTextFormat = `${rollingstockSerie}${rollingstockSubserie}${metadata?.family} / ${metadata?.type} / ${metadata?.grouping}${rollingstock.name}`;

      const rollingstockVolages = Object.keys(rollingstock.effort_curves.modes)
        .map((key) => `${key}V`)
        .join('');
      const rollingstockLength = `${rollingstock.length}M`;
      const rollingstockMass = `${Math.round(rollingstock.mass / 1000)}T`;
      const rollingstockMaxSpeed = `${Math.round(rollingstock.max_speed * 3.6)}KM/H`;

      const footerTextFormat = `${rollingstockVolages}${rollingstockLength}${rollingstockMass}${rollingstockMaxSpeed}`;

      // Check if the rollingstocks info and footer are displayed correctly
      expect(infoCardText).toContain(infoTextFormat);
      expect(footerCardText).toContain(footerTextFormat);
    });
  });
});
