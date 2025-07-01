import { expect } from '@playwright/test';

import test from './logging-fixture';
import HomePage from './pages/home-page';
import readJsonFile from './utils/file-utils';
import type { FlatTranslations } from './utils/types';

const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/translation.json');

test.describe('Home page OSRD', () => {
  let homePage: HomePage;

  test.beforeEach('Navigate to the home page', async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goToHomePage();
  });

  test.afterEach('Returns to the home page', async () => {
    await homePage.backToHomePage();
  });

  /** *************** Test 1 **************** */
  test('Verify the links for different pages in Home Page', async () => {
    // List of expected links on the home page
    const expectedLinks = [
      frTranslations.operationalStudies,
      frTranslations.stdcm,
      frTranslations.editor,
      frTranslations.rollingStockEditor,
      frTranslations.map,
    ];

    // Verify that the displayed links match the expected ones
    await expect(homePage.linksTitle).toHaveText(expectedLinks);
  });

  /** *************** Test 2 **************** */
  test('Verify redirection to the Operational Studies page', async () => {
    await homePage.goToOperationalStudiesPage();
    await expect(homePage.page).toHaveURL(/.*\/operational-studies/); // Check the URL
  });

  /** *************** Test 3 **************** */
  test('Verify redirection to the Map page', async () => {
    await homePage.goToCartoPage();
    await expect(homePage.page).toHaveURL(/.*\/map/);
  });

  /** *************** Test 4 **************** */
  test('Verify redirection to the Infrastructure editor page', async () => {
    await homePage.goToEditorPage();
    await expect(homePage.page).toHaveURL(/.*\/editor\/*/);
  });

  /** *************** Test 5 **************** */
  test('Verify redirection to the STDCM page', async ({ context }) => {
    const stdcmPage = await homePage.goToSTDCMPage(context);
    await expect(stdcmPage).toHaveURL(/.*\/stdcm/);
  });
});
