import { expect } from '@playwright/test';

import type { RollingStock } from 'common/api/osrdEditoastApi';

import { ROCKET_SEARCH_INPUT } from '../02-operational-studies/itineraryModal/itinerary-modal.consts';
import {
  E2E_GROUP,
  E2E_USERS,
  GRANT_LABELS,
  type E2EUser,
} from '../assets/constants/permission-const';
import { STDCM_URL } from '../assets/constants/stdcm/stdcm-const';
import test from '../page-object-fixture';
import type RollingstockEditorPage from '../pages/rolling-stock/rolling-stock-editor-page';
import { fillAndCheckInputById, generateUniqueName, waitForInfraStateToBeCached } from '../utils';
import { deleteApiRequest, getInfra } from '../utils/api-utils';
import { addGrants } from '../utils/authz-utils';
import { readJsonFile } from '../utils/file-utils';
import {
  forceDeleteRollingStock,
  setRollingStockLocked,
  unlockRollingStock,
} from '../utils/rolling-stock-utils';
import createScenario from '../utils/scenario';
import { createProject, createStudy } from '../utils/setup-utils';

const TRAIN_NAME = 'Limited train';

const READ_ONLY_ACTIONS = { canEdit: false, canDuplicate: true, canDelete: false };

const ROLLING_STOCK_JSON = readJsonFile<object>(
  './tests/assets/rolling-stock/fast_rolling_stock.json'
);

test.describe('Rolling stock permissions', { tag: ['@rs-editor', '@permissions'] }, () => {
  let rollingStock: RollingStock;
  let createdRollingStockIds: number[];
  let createdProjectIds: number[];

  // The infra grant is never revoked, so that parallel tests (e.g. the same test on several browser
  // projects) don't remove each other's access
  const createScenarioFor = async (user: E2EUser) => {
    const infra = await getInfra();
    const project = await createProject(generateUniqueName('project-rs-permissions'));
    createdProjectIds.push(project.id);
    const study = await createStudy(project.id);
    const { scenario } = await createScenario(undefined, project.id, study.id, infra.id);
    await addGrants('project', project.id, [{ subject: user, grant: 'OWNER' }]);
    await addGrants('infra', infra.id, [{ subject: user, grant: 'RESTRICTED_READER' }]);
    return {
      scenarioUrl: `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`,
      infraId: infra.id,
    };
  };

  const openInEditor = async (rollingStockEditorPage: RollingstockEditorPage) => {
    await rollingStockEditorPage.navigateToRollingStockPage();
    await rollingStockEditorPage.searchRollingStock(rollingStock.name);
    await rollingStockEditorPage.selectRollingStock(rollingStock.name);
  };

  const expectReaderView = async (rollingStockEditorPage: RollingstockEditorPage) => {
    await rollingStockEditorPage.expectUserGrant(GRANT_LABELS.read, { canSeeDetails: true });
    await rollingStockEditorPage.expectFullInformationPanel(true);
    await rollingStockEditorPage.expectRollingStockActions(READ_ONLY_ACTIONS);
  };

  test.beforeEach(
    'Owner creates a rolling stock and shares it',
    async ({ homePage, rollingStockEditorPage }) => {
      createdRollingStockIds = [];
      createdProjectIds = [];

      await homePage.impersonateUser(E2E_USERS.owner);
      await rollingStockEditorPage.navigateToRollingStockPage();
      rollingStock = await rollingStockEditorPage.importRollingStock({
        ...ROLLING_STOCK_JSON,
        name: generateUniqueName('RS-e2e'),
      });
      createdRollingStockIds.push(rollingStock.id);

      await homePage.stopImpersonation();

      await addGrants('rolling_stock', rollingStock.id, [
        { subject: E2E_USERS.reader, grant: 'READER' },
        { subject: E2E_USERS.writer, grant: 'WRITER' },
        { subject: E2E_USERS.limited, grant: 'RESTRICTED_READER' },
      ]);
    }
  );

  test.afterEach('Delete the test data', async () => {
    await Promise.all([
      ...createdProjectIds.map((id) => deleteApiRequest(`/api/projects/${id}`)),
      ...createdRollingStockIds.map(async (id) => {
        await unlockRollingStock(id);
        await forceDeleteRollingStock(id);
      }),
    ]);
  });

  /** *************** Test 1 **************** */
  test('A user without grant does not see the rolling stock', async ({
    page,
    homePage,
    rollingStockEditorPage,
    consistSection,
    scenarioTimetableSection,
    itineraryModalPage,
  }) => {
    const { scenarioUrl, infraId } = await createScenarioFor(E2E_USERS.stranger);

    await homePage.impersonateUser(E2E_USERS.stranger);

    // Matches the same search, so the list is known to be loaded when checking the Owner's one
    await rollingStockEditorPage.navigateToRollingStockPage();
    const strangerRollingStock = await rollingStockEditorPage.importRollingStock({
      ...ROLLING_STOCK_JSON,
      name: `${rollingStock.name}-stranger`,
    });
    createdRollingStockIds.push(strangerRollingStock.id);
    const expectedListing = {
      listed: [strangerRollingStock.name],
      notListed: [rollingStock.name],
    };

    await test.step('Rolling stock editor', async () => {
      await rollingStockEditorPage.navigateToRollingStockPage();
      await rollingStockEditorPage.searchRollingStockAndCheckResults(
        rollingStock.name,
        expectedListing
      );
    });

    await test.step('Train form rolling stock selector', async () => {
      await page.goto(scenarioUrl);
      await waitForInfraStateToBeCached(infraId);
      await scenarioTimetableSection.openItineraryModal();
      await itineraryModalPage.searchRollingStockAndCheckSuggestions(
        rollingStock.name,
        expectedListing
      );
    });

    await test.step('STDCM traction engine selector', async () => {
      await page.goto(STDCM_URL);
      await consistSection.searchTractionEngineAndCheckSuggestions(
        rollingStock.name,
        expectedListing
      );
    });
  });

  /** *************** Test 2 **************** */
  test('Read and restricted read grants give different views of the rolling stock', async ({
    homePage,
    rollingStockEditorPage,
  }) => {
    await test.step('Reader', async () => {
      await homePage.impersonateUser(E2E_USERS.reader);
      await openInEditor(rollingStockEditorPage);
      await expectReaderView(rollingStockEditorPage);
      await homePage.stopImpersonation();
    });

    await test.step('Limited', async () => {
      await homePage.impersonateUser(E2E_USERS.limited);
      await openInEditor(rollingStockEditorPage);
      await rollingStockEditorPage.expectUserGrant(GRANT_LABELS.restrictedRead, {
        canSeeDetails: false,
      });
      await rollingStockEditorPage.expectFullInformationPanel(false);
      await rollingStockEditorPage.expectRollingStockActions({
        canEdit: false,
        canDuplicate: false,
        canDelete: false,
      });
    });
  });

  /** *************** Test 3 **************** */
  // The train form fetches the full rolling stock (GET /api/rolling_stock/{id}), which requires the
  // read grant: a restricted reader gets a 403 and is redirected to the 403 page
  test.fixme('A restricted read grant is enough to use the rolling stock', async ({
    page,
    homePage,
    consistSection,
    scenarioTimetableSection,
    itineraryModalPage,
    opSimulationResultPage,
  }) => {
    const { scenarioUrl, infraId } = await createScenarioFor(E2E_USERS.limited);

    await homePage.impersonateUser(E2E_USERS.limited);

    await test.step('Select it in the STDCM traction engine selector', async () => {
      await page.goto(STDCM_URL);
      await consistSection.selectTractionEngine(rollingStock.name);
    });

    await test.step('Add a train with it in a scenario', async () => {
      await page.goto(scenarioUrl);
      await waitForInfraStateToBeCached(infraId);
      await scenarioTimetableSection.openItineraryModal();
      await itineraryModalPage.fillRollingStock(rollingStock.name);
      await itineraryModalPage.checkRollingStock(rollingStock.name);
      await itineraryModalPage.fillAndCheckTrainName(TRAIN_NAME);
      await itineraryModalPage.launchRocketSearch(ROCKET_SEARCH_INPUT);
      await itineraryModalPage.createTrain();
      await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
    });

    await test.step('The train simulates', async () => {
      await scenarioTimetableSection.projectTrain();
      await opSimulationResultPage.verifySimulationResultsVisibility();
    });
  });

  /** *************** Test 4 **************** */
  test('A write grant allows editing the rolling stock until it is locked', async ({
    page,
    homePage,
    rollingStockEditorPage,
  }) => {
    await homePage.impersonateUser(E2E_USERS.writer);
    await openInEditor(rollingStockEditorPage);

    await test.step('Check the write grant', async () => {
      await rollingStockEditorPage.expectUserGrant(GRANT_LABELS.write, { canSeeDetails: true });
      await rollingStockEditorPage.expectRollingStockActions({
        canEdit: true,
        canDuplicate: true,
        canDelete: false,
      });
    });

    await test.step('Edit a field, save and reload', async () => {
      await rollingStockEditorPage.editRollingStock(rollingStock.name);
      await fillAndCheckInputById(page, 'startupTime', 7);
      await rollingStockEditorPage.saveRollingStock();
      await openInEditor(rollingStockEditorPage);
      await rollingStockEditorPage.verifyRollingStockDetailsTable([
        { id: 'startupTime', value: '7s' },
      ]);
    });

    await test.step('Lock it and try to edit again', async () => {
      // The rolling stock editor has no lock button: the Writer locks it through the API
      await setRollingStockLocked(rollingStock.id, true, E2E_USERS.writer);
      await openInEditor(rollingStockEditorPage);
      await rollingStockEditorPage.expectUserGrant(GRANT_LABELS.write, { canSeeDetails: true });
      await rollingStockEditorPage.expectRollingStockActions(READ_ONLY_ACTIONS);
    });
  });

  /** *************** Test 5 **************** */
  test('The owner can delete the rolling stock', async ({ homePage, rollingStockEditorPage }) => {
    await test.step('Owner deletes it', async () => {
      await homePage.impersonateUser(E2E_USERS.owner);
      await openInEditor(rollingStockEditorPage);
      await rollingStockEditorPage.expectUserGrant(GRANT_LABELS.full, { canSeeDetails: true });
      await rollingStockEditorPage.deleteRollingStock(rollingStock.name);
      await rollingStockEditorPage.searchRollingStock(rollingStock.name, false);
      await expect(rollingStockEditorPage.noRollingStockResult).toBeVisible();
      await homePage.stopImpersonation();
    });

    await test.step('It is gone for the Reader', async () => {
      await homePage.impersonateUser(E2E_USERS.reader);
      await rollingStockEditorPage.navigateToRollingStockPage();
      await rollingStockEditorPage.searchRollingStock(rollingStock.name, false);
      await expect(rollingStockEditorPage.noRollingStockResult).toBeVisible();
    });
  });

  /** *************** Test 6 **************** */
  test('A read grant given to a group applies to its members', async ({
    homePage,
    rollingStockEditorPage,
  }) => {
    await test.step('Owner shares it with the group', async () => {
      await homePage.impersonateUser(E2E_USERS.owner);
      await openInEditor(rollingStockEditorPage);
      await rollingStockEditorPage.addGrantsToSubjects([
        { subjectName: E2E_GROUP, grant: 'READER' },
      ]);
      await homePage.stopImpersonation();
    });

    await test.step('A group member gets the read view', async () => {
      await homePage.impersonateUser(E2E_USERS.groupMember);
      await openInEditor(rollingStockEditorPage);
      await expectReaderView(rollingStockEditorPage);
    });
  });
});
