import { test, expect } from '@playwright/test';

import HomePage from './pages/home-page-model';

// Describe the test suite for the home page of OSRD
test.describe('Home page OSRD', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    // Create an instance of the HomePage class
    homePage = new HomePage(page);
    // Go to the home page of OSRD
    await homePage.goToHomePage();
  });

  test.afterEach(async () => {
    // Navigate back to the home page of OSRD
    await homePage.backToHomePage();
  });

  // Test that the home page of OSRD displays links to other pages
  test('should display links in the home page', async () => {
    await homePage.getDisplayLinks();
  });

  test('should be correctly redirected to the  "Operational Studies" page after clicking on the link', async () => {
    // Navigate to the "Operational Studies" page
    await homePage.goToOperationalStudiesPage();
    // Check that the URL of the page matches the expected pattern
    await expect(homePage.page).toHaveURL(/.*\/operational-studies/);
  });

  test('should be correctly redirected to the  "Map" page after clicking on the link', async () => {
    // Navigate to the "Map" page
    await homePage.goToCartoPage();

    // Check that the URL of the page matches the expected pattern
    await expect(homePage.page).toHaveURL(/.*\/map/);
  });

  test('should be correctly redirected to the  "Editor" page after clicking on the link', async () => {
    // Navigate to the "Editor" page
    await homePage.goToEditorPage();

    // Check that the URL of the page matches the expected pattern
    await expect(homePage.page).toHaveURL(/.*\/editor\/*/);
  });

  test('should be correctly redirected to the  "STDCM" page after clicking on the link', async ({
    context,
  }) => {
    // Start waiting for new page before clicking. Note no await.
    const pagePromise = context.waitForEvent('page');

    // Navigate to the "STDCM" page
    await homePage.goToSTDCMPage();

    const newPage = await pagePromise;

    // Check that the URL of the page matches the expected pattern
    await expect(newPage).toHaveURL(/.*\/stdcm/);
  });
});
