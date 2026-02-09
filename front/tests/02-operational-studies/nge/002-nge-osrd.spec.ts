import { expect } from '@playwright/test';

import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

test.describe('@op @nge @round-trips', () => {
  test.use({ ignorePageErrors: true });

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario and enable only macro view', async ({ page, ngePage }) => {
    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenarioItems = (
        await createScenario(generateUniqueName('nge-scenario'), project.id, study.id, infra.id)
      ).scenario;
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });

    await test.step('Enable macro view while keeping the default train list visible', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('@smoke Add a train from NGE', async ({
    ngePage,
    scenarioTimetableSection,
    roundTripPage,
  }) => {
    await test.step('Create three nodes', async () => {
      await ngePage.createNode({ x: 50, y: 400 }, 'NWS', 'Origin');
      await expect(ngePage.nodeCards).toHaveCount(1);

      await ngePage.createNode({ x: 250, y: 400 }, 'MWS', 'OP');
      await expect(ngePage.nodeCards).toHaveCount(2);

      await ngePage.createNode({ x: 450, y: 400 }, 'SS', 'Destination');
      await expect(ngePage.nodeCards).toHaveCount(3);
    });

    await test.step('Connect Origin → OP and create Train1', async () => {
      await ngePage.connectNodesByIndex(0, 1);
      await expect(ngePage.trainDetailsGroup).toBeVisible();
      await ngePage.setTrainBasics({ name: 'Train1', isFrequency30: true });
      await ngePage.closeDetailsDialogIfVisible();
      await expect(ngePage.trainDetailsGroup).toBeHidden();
      await expect(ngePage.trainLines).toHaveCount(1);
    });

    await test.step('Connect OP → Destination', async () => {
      await ngePage.connectNodesByIndex(1, 2);
      await expect(ngePage.trainDetailsGroup).toBeHidden();
      await expect(ngePage.trainLines).toHaveCount(2);
    });

    await test.step('Validate timetable list and round-trip modal', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 2,
        totalUniqueTrainCount: 0,
      });
      await scenarioTimetableSection.verifyInvalidReasons([
        frTranslations.timetable.invalid.rolling_stock_not_found,
        frTranslations.timetable.invalid.rolling_stock_not_found,
      ]);

      await roundTripPage.openRoundTripModal();
      await roundTripPage.assertRoundTripColumnCounts({
        expectedToDoCount: 0,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 1,
      });
    });
  });
});
