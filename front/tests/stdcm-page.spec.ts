import { test } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import playwrightDataTest from './playwright-data-test.json';
import { PlaywrightSTDCMPage } from './stdcm-page-model';

// Describe the test suite for the STDCM page
test.describe('STDCM page', () => {
  // Declare the necessary variables for the test suite
  let playwrightHomePage: PlaywrightHomePage;
  // let playwrightSTDCMPage: PlaywrightSTDCMPage;

  // This function will run before all the tests in this suite
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    // Create an instance of the PlaywrightHomePage class
    playwrightHomePage = new PlaywrightHomePage(page);

    // Create an instance of the PlaywrightSTDCMPage class
    // playwrightSTDCMPage = new PlaywrightSTDCMPage(page);

    // Go to the home page of OSDR
    await playwrightHomePage.goToHomePage();

    await playwrightHomePage.goToSTDCMPage();
  });
});
