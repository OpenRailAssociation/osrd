import { test, expect } from './baseFixtures';
import { PlaywrightHomePage } from './pages/home-page-model';

// Describe the test suite for the home page of OSRD
test.describe('Home page OSRD', () => {
  let playwrightHomePage: PlaywrightHomePage;

  test.beforeEach(async ({ page }) => {
    // Create an instance of the PlaywrightHomePage class
    playwrightHomePage = new PlaywrightHomePage(page);
    // Go to the home page of OSRD
    await playwrightHomePage.goToHomePage();
  });

  test.afterEach(async () => {
    // Navigate back to the home page of OSRD
    await playwrightHomePage.backToHomePage();
  });

  // Test that the home page of OSRD displays links to other pages
  test('should display links in the home page', async () => {
    await playwrightHomePage.getDisplayLinks();
  });

  test('should be correctly redirected to the  "Operational Studies" page after clicking on the link', async () => {
    // Navigate to the "Operational Studies" page
    await playwrightHomePage.goToOperationalStudiesPage();
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
