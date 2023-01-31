import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import { dataInfraFourItems } from './playwright-data-test';
import { PlaywrightSTDCMPage } from './stdcm-page-model';

// Describe the test suite for the STDCM page
test.describe.only('STDCM page', () => {
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
    // Navigate to the "STDCM" page
    await playwrightHomePage.goToSTDCMPage();
  });

  test('should be correctly displays the infrastructures list with 4 infrastructures', async () => {
    // Intercept the infrastructures request and return data test results
    await playwrightSTDCMPage.page.route('**/infra/', async (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(dataInfraFourItems),
      });
    });

    // Check that the modal is not open before clicking the button
    await playwrightSTDCMPage.getModalClose();

    // Clicking the infrastructure selector button
    await playwrightSTDCMPage.openInfraSelector();

    // Check that the modal is open now
    await playwrightSTDCMPage.getModalOpen();

    // Check that the number of infrastructure items is 4
    expect(playwrightSTDCMPage.getInfraListItems).toHaveCount(4);

    await playwrightSTDCMPage.checkNumberOfInfra(4);
  });
});
