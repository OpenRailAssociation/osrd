import { expect } from '@playwright/test';

import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

test.describe('Netzgrafik Editor', { tag: ['@op', '@nge', '@round-trips'] }, () => {
  test.use({ ignorePageErrors: true });

  setupScenarioFixture({
    scenarioNamePrefix: 'nge-scenario',
    trains: [],
    scope: 'test',
  });

  test.beforeEach(
    'Enable macro view while keeping the default train list visible',
    async ({ ngePage }) => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    }
  );

  /** *************** Test 1 **************** */
  test(
    'Add a train from NGE',
    { tag: '@smoke' },
    async ({ ngePage, scenarioTimetableSection, roundTripPage }) => {
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

      await test.step('Validate timetable list ', async () => {
        await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
          totalPacedTrainCount: 2,
          totalUniqueTrainCount: 0,
        });
      });
      // TODO: Remove the skip when issue https://github.com/OpenRailAssociation/osrd/issues/13066#issuecomment-4460021982 is resolved.
      await test.step.skip(
        'Validate that the train is marked as invalid due to missing rolling stock',
        async () => {
          await scenarioTimetableSection.verifyInvalidReasons([
            frTranslations.timetable.invalid.rolling_stock_not_found,
            frTranslations.timetable.invalid.rolling_stock_not_found,
          ]);
        }
      );
      await test.step('Validate round-trip modal', async () => {
        await roundTripPage.openRoundTripModal();
        await roundTripPage.assertRoundTripColumnCounts({
          expectedToDoCount: 0,
          expectedOneWayCount: 0,
          expectedRoundTripCount: 1,
        });
      });
    }
  );
});
