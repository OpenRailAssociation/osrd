import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
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

    await playwrightSTDCMPage.getScenarioExploratorModalClose();

    // Opens the scenario explorator and selects project, study and scenario
    await playwrightSTDCMPage.openScenarioExplorator();
    await playwrightSTDCMPage.getScenarioExploratorModalOpen();
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('Project test');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('Study test');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('Scenario test');
  });

  test('should be correctly displays the rolling stock list and select one', async () => {
    const rollingStockTranslation =
      playwrightSTDCMPage.getmanageTrainScheduleTranslations('rollingstock');
    const rollingStockTranslationRegEx = new RegExp(rollingStockTranslation as string);
    const rollingstockItem = playwrightSTDCMPage.getRollingstockByTestId(
      `rollingstock-BB 7200GVLOCOMOTIVES`
    );
    // Check that no rollingstock is selected
    await expect(
      playwrightSTDCMPage.getRollingStockSelector.locator('.rollingstock-minicard')
    ).not.toBeVisible();
    await expect(playwrightSTDCMPage.getMissingParam).toContainText(rollingStockTranslationRegEx);

    await playwrightSTDCMPage.getRollingstockModalClose();
    await playwrightSTDCMPage.openRollingstockModal();
    await playwrightSTDCMPage.getRollingstockModalOpen();

    await playwrightSTDCMPage.page.waitForSelector('.rollingstock-container');

    const numberOfRollingstock = await playwrightSTDCMPage.getRollingStockListItem.count();

    expect(numberOfRollingstock).toEqual(3);

    const infoCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-infos')
      .allTextContents();
    expect(infoCardText).toContain(
      'BB 7200GVLOCOMOTIVES / Locomotives électriques / Locomotives électriques courant continuBB 7200GVLOCOMOTIVES'
    );
    expect(infoCardText).toContain(
      'BB 15000BB15000 USLOCOMOTIVES / Locomotives électriques / Locomotives électriques monophaséLocomotives électriques'
    );
    expect(infoCardText).toContain(
      'BB 22200V160LOCOMOTIVES / Locomotives électriques / Locomotives électriques bi courantLocomotives électriques courant continu7200GH'
    );

    const footerCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-footer')
      .allTextContents();
    expect(footerCardText).toContain('400m900t288km/h');

    // Check if rollingstock detail is close
    await expect(rollingstockItem).toHaveClass(/inactive/);
    await rollingstockItem.click();

    // Check if rollingstock detail is open
    await expect(rollingstockItem).toHaveClass(/active/);

    await rollingstockItem.locator('.rollingstock-footer-buttons > button').click();

    // Check that the rollingstock is selected
    await expect(
      playwrightSTDCMPage.getRollingStockSelector.locator('.rollingstock-minicard')
    ).toBeVisible();

    await expect(playwrightSTDCMPage.getMissingParam).not.toContainText(
      rollingStockTranslationRegEx
    );

    await playwrightHomePage.backToHomePage();
  });
});
