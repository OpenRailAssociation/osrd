import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import playwrightDataTest from './playwright-data-test.json';
import { PlaywrightSTDCMPage } from './stdcm-page-model';

const { dataInfraFourItems } = playwrightDataTest;

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

    // Loop on the infrastructures and check that the details are correct.
    dataInfraFourItems.forEach((infra) => {
      const { name, locked, id, railjson_version, version } = infra;
      const infraButton = playwrightSTDCMPage.page.getByTestId(`infraslist-item-${id}`);

      // Check if the infrastructure has the correct class for locked/unlocked
      expect(infraButton).toHaveClass(locked ? /locked/ : /unlocked/);

      // Check that the infrastructure is not selected
      expect(infraButton).not.toHaveClass('active');

      // Check if the infrastructure name, ID, RAILJSON version, and version are correctly displayed
      expect(infraButton.locator('span')).toContainText([
        name,
        `ID ${id}`,
        `RAILJSON V${railjson_version}`,
        `V${version}`,
      ]);
    });

    // Check the number of infrastructures displayed
    await playwrightSTDCMPage.checkNumberOfInfra(4);

    // Click on the page body to close the modal
    await playwrightSTDCMPage.getBody.click();

    // Check if the modal is closed
    await playwrightSTDCMPage.getModalClose();
  });
});
