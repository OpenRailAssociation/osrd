import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';

// Describe the test suite for the home page of OSDR
test.describe('Home page OSDR', () => {
  // Declare the necessary variable for the test
  let playwrightHomePage: PlaywrightHomePage;

  // This function will run before all the tests in this suite
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    // Create an instance of the PlaywrightHomePage class
    playwrightHomePage = new PlaywrightHomePage(page);
    // Go to the home page of OSDR
    await playwrightHomePage.goToHomePage();
  });
  // This function will run after each test in this suite
  test.afterEach(async () => {
    // Navigate back to the home page of OSDR
    await playwrightHomePage.backToHomePage();
  });

  // Test that the home page of OSDR displays links to other pages
  test('should display links in the home page', async () => {
    await playwrightHomePage.getDisplayLinks();
  });

  test('should be correctly redirected to the  "Operational Studies" page after clicking on the link', async () => {
    // Navigate to the "Operational Studies" page
    await playwrightHomePage.goToStudiesPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/operational-studies/);
  });

  test('should be correctly redirected to the  "Map" page after clicking on the link', async () => {
    // Navigate to the "Map" page
    await playwrightHomePage.goToCartoPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/map/);
  });

  test('should be correctly redirected to the  "Editor" page after clicking on the link', async () => {
    // Navigate to the "Editor" page
    await playwrightHomePage.goToEditorPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/editor\/*/);
  });

  test('should be correctly redirected to the  "STDCM" page after clicking on the link', async () => {
    // Navigate to the "STDCM" page
    await playwrightHomePage.goToSTDCMPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/stdcm/);
  });
});
