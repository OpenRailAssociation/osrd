import { expect } from '@playwright/test';

import test from './../page-object-fixture';
import { readJsonFile } from '../utils/file-utils';
import type { FlatTranslations } from '../utils/types';

const frTranslations: { applications: FlatTranslations } = readJsonFile(
  'public/locales/fr/translation.json'
);

test.describe('@home @navigation', () => {
  test.beforeEach('Navigate to the home page', async ({ homePage }) => {
    await homePage.goToHomePage();
  });

  /** *************** Test 1 **************** */
  test('@smoke Verify the links for different pages in Home Page', async ({ homePage }) => {
    const expectedLinks = [
      frTranslations.applications['operational-studies'],
      frTranslations.applications.stdcm,
      frTranslations.applications['infrastructures-editor'],
      frTranslations.applications['rolling-stocks-editor'],
      frTranslations.applications['reference-map'],
    ];

    await expect(homePage.linksTitle).toHaveText(expectedLinks);
  });

  /** *************** Test 2 **************** */
  test('@smoke Verify redirection to the Operational Studies page', async ({ homePage }) => {
    await homePage.goToOperationalStudiesPage();
    await expect(homePage.page).toHaveURL(/.*\/operational-studies/);
  });

  /** *************** Test 3 **************** */
  test('Verify redirection to the Map page', async ({ homePage }) => {
    await homePage.goToCartoPage();
    await expect(homePage.page).toHaveURL(/.*\/map/);
  });

  /** *************** Test 4 **************** */
  test('Verify redirection to the Infrastructure editor page', async ({ homePage }) => {
    await homePage.goToEditorPage();
    await expect(homePage.page).toHaveURL(/.*\/editor\/*/);
  });

  /** *************** Test 5 **************** */
  test('@smoke Verify redirection to the STDCM page', async ({ context, homePage }) => {
    const stdcmPage = await homePage.goToSTDCMPage(context);
    await expect(stdcmPage).toHaveURL(/.*\/stdcm/);
  });
});
