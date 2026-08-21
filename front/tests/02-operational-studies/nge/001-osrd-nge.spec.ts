import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';
import type { TimetableFilterTranslations } from '../../utils/types';

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

const frTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

test.describe('Netzgrafik Editor', { tag: ['@op', '@nge'] }, () => {
  test.beforeEach('Clear local storage before loading the scenario', async ({ page }) => {
    // scenario header is persisted in local storage, clear it before loading the scenario
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  setupScenarioFixture({
    scenarioNamePrefix: 'nge-scenario',
    trains: trains.slice(11, 12),
    scope: 'test',
  });

  test.beforeEach(
    'Enable macro view while keeping the default train list visible',
    async ({ ngePage }) => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    }
  );

  /** *************** Test 1 **************** */
  test('Verify NGE train data', async ({ ngePage }) => {
    await test.step('Verify nodes displayed on NGE graph', async () => {
      await ngePage.expectNodes(['SWS/BV#…', 'MWS/BV…', 'MES/BV#…']);
    });

    await test.step('Verify train rows labels', async () => {
      await ngePage.expectTrainLineLabels(0, ['30', '52', "22'", 'Train5']);
      await ngePage.expectTrainLineLabels(1, ['52', '?', '?', 'Train5']);
    });

    await test.step('Open first train and verify all details (stations, tags, and one-way tab)', async () => {
      await test.step('Open first train details dialog and verify header name is Train5', async () => {
        await ngePage.openTrainDetailsFromLine(0);
        await ngePage.expectDialogHeaderTrainName('Train5');
      });

      await test.step('Verify stations tab shows Mid_West_station and South_West_station', async () => {
        await ngePage.expectStationsTabShows(['Mid_West_station', 'South_West_station']);
      });

      await test.step('Verify tags tab lists Tag-5 and SWE-MES', async () => {
        await ngePage.openTagsTabAndExpect(['Tag-5', 'SWE-MES']);
      });

      await test.step('Verify one-way tab shows SWS/BV (South_West_station) → MES/BV (Mid_East_station)', async () => {
        const oneWayRegex =
          /SWS\/BV#FR\s*\(South_West_station\)[\s\S]*?30[\s\S]*?MES\/BV#FR\s*\(Mid_East_station\)/i;
        await ngePage.openOneWayTabAndExpect(oneWayRegex);
      });

      await test.step('Close train details dialog if visible', async () => {
        await ngePage.closeDetailsDialogIfVisible();
      });
    });

    await test.step('Open second train details and verify stations', async () => {
      await ngePage.openTrainDetailsFromLine(1);
      await ngePage.expectDialogHeaderTrainName('Train5');
      await ngePage.expectStationsTabShows(['Mid_East_station', 'Mid_West_station']);
    });
  });

  /** *************** Test 2 **************** */
  test('Delete a train from train list', async ({ page, scenarioTimetableSection, ngePage }) => {
    await test.step('Delete train from timetable list', async () => {
      await scenarioTimetableSection.deleteTrainSchedule();
    });

    await test.step('Reload page to refresh timetable state', async () => {
      await page.reload(); // Should be removed once issue #13758 is resolved
    });

    await test.step('Verify timetable is empty (UI message)', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(
        frTranslations.timetable.noTrainSchedule
      );
    });

    await test.step('Enable macro view while keeping the default train list visible', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    });

    await test.step('Verify NGE lines are deleted (no train lines but nodes are persisted)', async () => {
      await ngePage.verifyNodeAndLinesCount({ nodes: 3, lines: 0 });
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a train from NGE', async ({ page, ngePage, scenarioTimetableSection }) => {
    await test.step('Delete first node via dialog (expect 2 nodes, 1 line)', async () => {
      await ngePage.deleteNodeByIndexViaDialog(0, { nodes: 2, lines: 1 });
    });

    await test.step('Delete next node via dialog (expect 1 node, 0 lines)', async () => {
      await ngePage.deleteNodeByIndexViaDialog(0, { nodes: 1, lines: 0 });
    });

    await test.step('Delete last node using keyboard (expect 0 nodes, 0 lines)', async () => {
      await ngePage.deleteFocusedNodeWithKeyboard({ nodes: 0, lines: 0 });
    });

    await test.step('Verify timetable is empty (UI)', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(
        frTranslations.timetable.noTrainSchedule
      );
    });

    await test.step('Reload and re-assert timetable is empty', async () => {
      await page.reload();
      await scenarioTimetableSection.verifyTimetableIsEmpty(
        frTranslations.timetable.noTrainSchedule
      );
    });

    await test.step('Re-toggle macro layout and re-assert graph is empty (expect 0 nodes, 0 lines)', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
      await ngePage.verifyNodeAndLinesCount({ nodes: 0, lines: 0 });
    });
  });
});
