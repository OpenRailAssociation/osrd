import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  electricRollingStockName,
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  ADDED_EXCEPTION_MENU_BUTTONS,
  ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS,
  CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  DISABLED_OCCURRENCE_MENU_BUTTONS,
  EDITED_OCCURRENCE_NAME,
  EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  INITIAL_OCCURRENCE_NAME,
  OCCURRENCE_EDITION_COMPOSITION_CODE,
  OCCURRENCE_EDITION_REMAINING_OCCURRENCES,
  OCCURRENCE_EDITION_REQUESTED_DEPARTURE,
  OCCURRENCE_EDITION_RESTORED_OCCURRENCE,
  OCCURRENCE_EDITION_ROUTE_SEARCH,
  OCCURRENCE_EDITION_STOP_DURATION_DIGITS,
  OCCURRENCE_EDITION_STOP_ROW_FILTER,
} from '../../assets/paced-train/const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  ChangeGroup,
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe(
  'Paced train occurrence edition',
  { tag: ['@op', '@paced-trains', '@exceptions'] },
  () => {
    //TODO: remove ignorePageErrors when issue #13066 is resolved
    test.use({ ignorePageErrors: true });

    let project: Project;
    let study: Study;
    let infra: Infra;

    let scenarioItems: Scenario;

    test.beforeAll(
      'Setup project, study, infra and create scenario with paced trains',
      async () => {
        project = await getProject(trainScheduleProjectName);
        study = await getStudy(project.id, trainScheduleStudyName);
        infra = await getInfra();
        const { scenario, trainScheduleSet } = await createScenario(
          generateUniqueName('paced-trains-scenario'),
          project.id,
          study.id,
          infra.id
        );
        scenarioItems = scenario;
        const trainsSubset = trains.slice(0, 6);
        await sendTrains(trainScheduleSet.id, trainsSubset, scenarioItems.timetable_id);
      }
    );

    test.beforeEach(
      'Navigate to scenario page and wait for infrastructure to be loaded',
      async ({ page }) => {
        await page.goto(
          `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
        );
        await waitForInfraStateToBeCached(infra.id);
      }
    );

    test.afterAll('Delete the created scenario', async () => {
      await deleteScenario(study.id, scenarioItems.name);
    });

    /** *************** Test 1 **************** */
    test('Edit an indexed occurrence', async ({ page, pacedTrainSection, headerPage }) => {
      await test.step('Open paced train and check initial menu (first occurrence)', async () => {
        await pacedTrainSection.expandPacedTrainOccurrenceList(0);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Select the occurrence and edit its name via the header', async () => {
        await page.keyboard.press('Escape'); // Close the occurrence action menu opened above
        await pacedTrainSection.clickOnOccurrence(0);
        await headerPage.expandHeader();
        await headerPage.setName(EDITED_OCCURRENCE_NAME);
      });

      await test.step('Verify edited occurrence tooltip and menu', async () => {
        await pacedTrainSection.checkExceptionTooltip(
          0,
          frTranslations.timetable.occurrenceType.editedOccurrence +
            frTranslations.timetable.occurrenceChangeGroup.train_name
        );
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Disable edited occurrence', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('disable');
        await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: DISABLED_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Re-enable edited occurrence', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('enable');
        await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Restore occurrence to initial model', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('restore');
        await pacedTrainSection.verifyOccurrenceName(0, INITIAL_OCCURRENCE_NAME);
      });
    });

    /** *************** Test 2 **************** */
    test('Edit added exception', async ({
      page,
      pacedTrainSection,
      headerPage,
      itineraryModalPage,
      timesStopsTablePage,
    }) => {
      await test.step('Open paced train and check initial menu state', async () => {
        await pacedTrainSection.expandPacedTrainOccurrenceList(4);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 1,
          expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
          pacedTrainIndex: 4,
        });
      });

      await test.step('Select the occurrence and edit rolling stock + speed limit tag via the header', async () => {
        await page.keyboard.press('Escape');
        await pacedTrainSection.clickOnOccurrence(1);
        await headerPage.expandHeader();
        await headerPage.setRollingStock(electricRollingStockName);
        await headerPage.selectCompositionCode(OCCURRENCE_EDITION_COMPOSITION_CODE);
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Modify the route via the itinerary modal opened from the header', async () => {
        await headerPage.openItinerary();
        await itineraryModalPage.launchRocketSearch(OCCURRENCE_EDITION_ROUTE_SEARCH);
        await itineraryModalPage.submitEdit();
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Edit stop duration and start time via the times and stops table', async () => {
        const midEastStationRow = timesStopsTablePage.dataRows.filter({
          hasText: OCCURRENCE_EDITION_STOP_ROW_FILTER,
        });
        await timesStopsTablePage.editStopDuration(
          midEastStationRow,
          OCCURRENCE_EDITION_STOP_DURATION_DIGITS
        );

        const originRow = timesStopsTablePage.getRow(0);
        await timesStopsTablePage.editRequestedDeparture(
          originRow,
          OCCURRENCE_EDITION_REQUESTED_DEPARTURE
        );
      });

      await test.step('Check exception tooltip after modifications', async () => {
        await pacedTrainSection.checkExceptionTooltip(
          1,
          frTranslations.timetable.occurrenceType.addedOccurrence,
          frTranslations.timetable.occurrenceChangeGroup.path_and_schedule as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.rolling_stock as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.speed_limit_tag as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
        );
      });

      await test.step('Check occurrence menu after modifications', async () => {
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 1,
          expectedButtons: ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
          pacedTrainIndex: 4,
        });
      });

      await test.step('Restore occurrence to model', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('restore');
        await pacedTrainSection.verifyOccurrenceDetails(OCCURRENCE_EDITION_RESTORED_OCCURRENCE, 1);

        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 1,
          expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
          pacedTrainIndex: 4,
        });
      });

      await test.step('Delete occurrence and check remaining ones', async () => {
        await pacedTrainSection.openOccurrenceActionMenu(1, 4);
        await pacedTrainSection.clickOccurrenceMenuButton('delete');

        await pacedTrainSection.expectOccurrencesListLength(
          OCCURRENCE_EDITION_REMAINING_OCCURRENCES.length
        );
        for (const [index, occurrence] of OCCURRENCE_EDITION_REMAINING_OCCURRENCES.entries()) {
          await pacedTrainSection.verifyOccurrenceDetails(occurrence, index);
        }
      });
    });
  }
);
