import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
import test from './logging-fixture';
import NGEPage from './pages/operational-studies/nge-page';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';
import type { TimetableFilterTranslations } from './utils/types';

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);

const frTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

test.describe('Verify osrd nge conversion', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test.use({ ignorePageErrors: true });

  let ngePage: NGEPage;
  let scenarioTimetableSection: ScenarioTimetableSection;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario and enable only macro view ', async ({ page }) => {
    ngePage = new NGEPage(page);
    scenarioTimetableSection = new ScenarioTimetableSection(page);
    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenarioItems = (
        await createScenario(generateUniqueName('nge-scenario'), project.id, study.id, infra.id)
      ).scenario;

      await sendTrainSchedules(scenarioItems.timetable_id, trainSchedulesJson.slice(4, 5));

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await ngePage.removeViteOverlay();
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Enable macro view while keeping the default train list visible', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test('Verify NGE train data', async () => {
    await test.step('Verify nodes displayed on NGE graph', async () => {
      await ngePage.expectNodes(['SWS/BV', 'MWS/BV', 'MES/BV']);
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
          /SWS\/BV\s*\(South_West_station\)[\s\S]*?30[\s\S]*?MES\/BV\s*\(Mid_East_station\)/i;
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

  test('Delete a train from train list', async ({ page }) => {
    await test.step('Delete train from timetable list', async () => {
      await scenarioTimetableSection.deleteTimetableItem();
    });

    await test.step('Reload page to refresh timetable state', async () => {
      await page.reload(); // Should be removed once issue #13758 is resolved
    });

    await test.step('Verify timetable is empty (UI message)', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(frTranslations.timetable.noTrain);
    });

    await test.step('Enable macro view while keeping the default train list visible', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
    });

    await test.step('Verify NGE graph is empty (no nodes or train lines)', async () => {
      await ngePage.verifyNodeAndLinesCount({ nodes: 0, lines: 0 });
    });
  });

  test('Delete a train from NGE', async ({ page }) => {
    await test.step('Delete first node via dialog (expect 2 nodes, 1 line)', async () => {
      await ngePage.deleteNodeByIndexViaDialog(0, { nodes: 2, lines: 1 });
    });

    await test.step('Delete next node via dialog (expect 1 node, 0 line)', async () => {
      await ngePage.deleteNodeByIndexViaDialog(0, { nodes: 1, lines: 0 });
    });

    await test.step('Delete last node using keyboard (expect 0 nodes, 0 line)', async () => {
      await ngePage.deleteFocusedNodeWithKeyboard({ nodes: 0, lines: 0 });
    });

    await test.step('Verify timetable is empty (UI)', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(frTranslations.timetable.noTrain);
    });

    await test.step('Reload and re-assert timetable is empty', async () => {
      await page.reload();
      await scenarioTimetableSection.verifyTimetableIsEmpty(frTranslations.timetable.noTrain);
    });

    await test.step('Re-toggle macro layout and re-assert graph is empty', async () => {
      await ngePage.enableMacroViewWithDefaultTrainList();
      await ngePage.verifyNodeAndLinesCount({ nodes: 0, lines: 0 });
    });
  });
});
