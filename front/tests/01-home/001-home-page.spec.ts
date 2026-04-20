import { expect } from '@playwright/test';

import { EXPECTED_HOME_LINKS } from '../assets/constants/homepage-const';
import test from './../page-object-fixture';

test.describe('Home page navigation', { tag: ['@home', '@navigation'] }, () => {
  test.beforeEach('Navigate to the home page', async ({ homePage }) => {
    await homePage.goToHomePage();
  });

  /** *************** Test 1 **************** */
  test(
    'Verify the links for different pages in Home Page',
    { tag: '@smoke' },
    async ({ homePage }) => {
      await expect(homePage.linksTitle).toHaveText(EXPECTED_HOME_LINKS);
    }
  );

  /** *************** Test 2 **************** */
  test(
    'Verify redirection to the Operational Studies page',
    { tag: '@smoke' },
    async ({ homePage }) => {
      await homePage.goToOperationalStudiesPage();
    }
  );

  /** *************** Test 3 **************** */
  test('Verify redirection to the Map page', async ({ homePage }) => {
    await homePage.goToCartoPage();
  });

  /** *************** Test 4 **************** */
  test('Verify redirection to the Infrastructure editor page', async ({ homePage }) => {
    await homePage.goToEditorPage();
  });

  /** *************** Test 5 **************** */
  test('Verify redirection to the STDCM page', { tag: '@smoke' }, async ({ context, homePage }) => {
    await homePage.goToSTDCMPage(context);
  });
});
