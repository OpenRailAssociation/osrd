import { expect } from '@playwright/test';

import { HOME_URLS, INFRA_EDITOR_URL } from '../assets/constants/homepage-const';
import { E2E_USERS } from '../assets/constants/permission-const';
import { STDCM_URL } from '../assets/constants/stdcm/stdcm-const';
import { PROJECT_URLS } from '../assets/operation-studies/project-const';
import test from '../page-object-fixture';

test.describe('Role gating', { tag: ['@home', '@permissions'] }, () => {
  test.afterEach('Stop the impersonation', async ({ homePage }) => {
    await homePage.stopImpersonation();
  });

  /** *************** Test A1 **************** */
  test('A user without role has every application greyed out', async ({ page, homePage }) => {
    await homePage.impersonateUser(E2E_USERS.noRole);

    await expect(page).toHaveURL(HOME_URLS.home);
    for (const tile of homePage.appTiles) {
      await homePage.expectTileDisabled(tile);
    }
  });

  /** *************** Test A2 **************** */
  test('A Stdcm only user is only offered STDCM', async ({ page, homePage, stdcmPage }) => {
    // The home page sends a user whose only application is STDCM straight to it
    await homePage.impersonateUser(E2E_USERS.stdcmOnly);
    await expect(page).toHaveURL(HOME_URLS.stdcm);
    await expect(stdcmPage.helpButton).toBeVisible();

    await page.goto(PROJECT_URLS.list);
    await homePage.expectAccessDeniedPage();
  });

  /** *************** Test A3 **************** */
  // Both editors currently open for a Stdcm only user (empty lists, read-only banner)
  // instead of showing the 403 page.
  test.fixme('A Stdcm only user cannot open the rolling stock and infrastructure editors', async ({
    page,
    homePage,
    rollingStockEditorPage,
  }) => {
    await homePage.impersonateUser(E2E_USERS.stdcmOnly);

    await rollingStockEditorPage.navigateToRollingStockPage();
    await homePage.expectAccessDeniedPage();

    await page.goto(INFRA_EDITOR_URL);
    await homePage.expectAccessDeniedPage();
  });

  /** *************** Test A4 **************** */
  test('An Operational Studies only user has STDCM greyed out', async ({ page, homePage }) => {
    await homePage.impersonateUser(E2E_USERS.projectOutsider);

    await homePage.expectTileDisabled(homePage.stdcmTile);
    for (const tile of homePage.appTiles.filter((appTile) => appTile !== homePage.stdcmTile)) {
      await homePage.expectTileEnabled(tile);
    }

    await page.goto(STDCM_URL);
    await homePage.expectAccessDeniedPage();
  });
});
