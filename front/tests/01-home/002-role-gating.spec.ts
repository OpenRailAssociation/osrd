import { expect } from '@playwright/test';

import { HOME_URLS, INFRA_EDITOR_URL, MAP_URL } from '../assets/constants/homepage-const';
import { E2E_USERS } from '../assets/constants/permission-const';
import { electricRollingStockName, infrastructureName } from '../assets/constants/project-const';
import { STDCM_URL } from '../assets/constants/stdcm/stdcm-const';
import { PROJECT_URLS } from '../assets/operation-studies/project-const';
import test from '../page-object-fixture';
import { waitForInfraStateToBeCached } from '../utils';
import { getInfra } from '../utils/api-utils';

test.describe('Role gating', { tag: ['@home', '@permissions'] }, () => {
  /** *************** Test 1 **************** */
  test('A user without role has every application greyed out', async ({ page, homePage }) => {
    await homePage.impersonateUser(E2E_USERS.noRole);

    await expect(page).toHaveURL(HOME_URLS.home);
    for (const tile of homePage.appTiles) {
      await homePage.expectTileDisabled(tile);
    }
  });

  /** *************** Test 2 **************** */
  test('A Stdcm only user is only offered STDCM', async ({ page, homePage, stdcmPage }) => {
    await homePage.impersonateUser(E2E_USERS.stdcmOnly);
    await expect(page).toHaveURL(HOME_URLS.stdcm);
    await waitForInfraStateToBeCached((await getInfra()).id);
    await stdcmPage.expectStdcmPageLoaded();

    await page.goto(PROJECT_URLS.list);
    await homePage.expectAccessDeniedPage();
  });

  /** *************** Test 3 **************** */
  test('A Stdcm only user cannot open the rolling stock editor, map and the infrastructure editor', async ({
    page,
    homePage,
    rollingStockEditorPage,
  }) => {
    await homePage.impersonateUser(E2E_USERS.stdcmOnly);

    await rollingStockEditorPage.navigateToRollingStockPage();
    await homePage.expectAccessDeniedPage();

    await page.goto(INFRA_EDITOR_URL);
    await homePage.expectAccessDeniedPage();

    await page.goto(MAP_URL);
    await homePage.expectAccessDeniedPage();
  });

  /** *************** Test 4 **************** */
  test('An Operational Studies only user can open its applications but not STDCM', async ({
    page,
    homePage,
    projectPage,
    rollingStockEditorPage,
  }) => {
    await homePage.impersonateUser(E2E_USERS.projectOutsider);

    await homePage.expectTileDisabled(homePage.stdcmTile);
    for (const tile of homePage.appTiles.filter((appTile) => appTile !== homePage.stdcmTile)) {
      await homePage.expectTileEnabled(tile);
    }

    await projectPage.openProjectListAndCheckItIsDisplayed();
    await rollingStockEditorPage.openRollingStockEditorAndCheckRollingStockIsListed(
      electricRollingStockName
    );
    await homePage.openAppAndCheckInfraIsListed(INFRA_EDITOR_URL, infrastructureName);
    await homePage.openAppAndCheckInfraIsListed(MAP_URL, infrastructureName);

    await page.goto(STDCM_URL);
    await homePage.expectAccessDeniedPage();
  });
});
