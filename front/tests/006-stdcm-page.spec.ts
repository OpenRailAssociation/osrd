import { test, expect } from './baseFixtures';
import { PlaywrightHomePage } from './pages/home-page-model';
import { PlaywrightSTDCMPage } from './pages/stdcm-page-model';

// Describe the test suite for the STDCM page
test.describe('STDCM page', () => {
  // Declare the necessary variables for the test suite
  let playwrightHomePage: PlaywrightHomePage;
  let playwrightSTDCMPage: PlaywrightSTDCMPage;

  test('should be correctly displays the rolling stock list and select one', async ({ page }) => {
    // Create an instance of the PlaywrightHomePage class
    playwrightHomePage = new PlaywrightHomePage(page);

    // Create an instance of the PlaywrightSTDCMPage class
    playwrightSTDCMPage = new PlaywrightSTDCMPage(page);

    // Go to the home page of OSRD
    await playwrightHomePage.goToHomePage();

    await playwrightHomePage.goToSTDCMPage();

    await playwrightSTDCMPage.getScenarioExploratorModalClose();

    // Opens the scenario explorator and selects project, study and scenario
    await playwrightSTDCMPage.openScenarioExplorator();
    await playwrightSTDCMPage.getScenarioExploratorModalOpen();
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('_@Test integration project');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('_@Test integration study');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('_@Test integration scenario');

    const rollingStockTranslation =
      playwrightSTDCMPage.getmanageTrainScheduleTranslations('rollingstock');
    const rollingStockTranslationRegEx = new RegExp(rollingStockTranslation as string);
    // Check that the three tests rolling stocks are present
    playwrightSTDCMPage.getRollingstockByTestId(`rollingstock-_@Test Locomotives électriques`);
    playwrightSTDCMPage.getRollingstockByTestId(`rollingstock-_@Test BB 22200`);
    const rollingstockItem = playwrightSTDCMPage.getRollingstockByTestId(
      `rollingstock-_@Test BB 7200GVLOCOMOTIVES`
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

    const infoCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-info')
      .allTextContents();
    expect(infoCardText).toContain(
      'BB 7200GVLOCOMOTIVES / Locomotives électriques / Locomotives électriques courant continu_@Test BB 7200GVLOCOMOTIVES'
    );
    expect(infoCardText).toContain(
      'BB 15000BB15000 USLOCOMOTIVES / Locomotives électriques / Locomotives électriques monophasé_@Test Locomotives électriques'
    );
    expect(infoCardText).toContain(
      'BB 22200V160LOCOMOTIVES / Locomotives électriques / Locomotives électriques bi courant_@Test BB 22200'
    );

    const footerCardText = await playwrightSTDCMPage.getRollingStockListItem
      .locator('.rollingstock-footer')
      .allTextContents();
    expect(footerCardText).toContain('25000V400m900t288km/h');

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
