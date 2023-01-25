import { test, expect, Page } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';

// Describe the test suite for the home page of OSDR
test.describe.only('Home page OSDR', () => {
  // Declare the necessary variable for the test
  let playwrightHomePage: PlaywrightHomePage;

  // This function will run before all the tests in this suite
  test.beforeAll(async ({ page }) => {
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

  test('should be correctly redirected to the  "Études d\'exploitation" page after clicking on the link', async () => {
    // Navigate to the "Études d'exploitation" page
    await playwrightHomePage.goToStudiesPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/operational-studies\/scenario/);
  });

  test('should be correctly redirected to the  "Cartographie" page after clicking on the link', async () => {
    // Navigate to the "Cartographie" page
    await playwrightHomePage.goToCartoPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/map/);
  });

  test('should be correctly redirected to the  "Éditeur d\'infrastructure" page after clicking on the link', async () => {
    // Navigate to the "Éditeur d'infrastructure" page
    await playwrightHomePage.goToEditorPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/editor\/*/);
  });

  test('should be correctly redirected to the  "Sillons de dernière minute" page after clicking on the link', async () => {
    // Navigate to the "Sillons de dernière minute" page
    await playwrightHomePage.goToSTDCMPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/stdcm/);
  });

  test('should be correctly redirected to the  "Importation horaires" page after clicking on the link', async () => {
    // Navigate to the "Importation horaires" page
    await playwrightHomePage.goToImportPage();

    // Check that the URL of the page matches the expected pattern
    await expect(playwrightHomePage.page).toHaveURL(/.*\/opendata\/import/);
  });
});
