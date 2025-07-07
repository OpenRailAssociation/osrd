import type { Scenario, Project, Study, Infra, PacedTrain } from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import {
  ADDED_EXCEPTION_MENU_BUTTONS,
  CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  DISABLED_OCCURRENCE_MENU_BUTTONS,
  EDITED_OCCURRENCE_NAME,
  EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  INITIAL_OCCURRENCE_NAME,
} from './assets/paced-train/const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import type {
  ChangeGroup,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from './utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frScenarioTranslations,
};

const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

test.describe('Edit trains and missions', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
  let operationalStudiesPage: OperationalStudiesPage;
  let pacedTrainSection: PacedTrainSection;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll(
    'Setup project, study, infra and create scenario with timetableItems',
    async () => {
      project = await getProject(trainScheduleProjectName);
      study = await getStudy(project.id, trainScheduleStudyName);
      infra = await getInfra();
      scenarioItems = (
        await createScenario(
          generateUniqueName('edit-train-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await sendPacedTrains(scenarioItems.timetable_id, pacedTrainsJson);
    }
  );

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test.beforeEach('Go to scenario page', async ({ page }) => {
    [pacedTrainSection, scenarioTimetableSection, operationalStudiesPage] = [
      new PacedTrainSection(page),
      new ScenarioTimetableSection(page),
      new OperationalStudiesPage(page),
    ];

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
    await page.waitForLoadState('networkidle');
  });

  test('Modify a paced train and create added exception', async () => {
    const editedPacedTrainData = pacedTrainsJson[1];

    await pacedTrainSection.editPacedTrain(1);

    await scenarioTimetableSection.verifyEditTrainScheduleButtonVisibility();

    await operationalStudiesPage.checkInputsBeforeEditingAPacedTrain(
      frTranslations,
      editedPacedTrainData.paced.time_window,
      editedPacedTrainData.paced.interval
    );

    await operationalStudiesPage.createPacedTrainException('2025-08-08', '12:00:00');

    await operationalStudiesPage.validateAndCloseTrainEdition();

    await operationalStudiesPage.checkToastHasBeenLaunched(
      frTranslations.timetable.pacedTrainUpdated
    );

    await pacedTrainSection.verifyOccurrenceDetails(
      {
        name: `${editedPacedTrainData.train_name}/+`,
        startTime: '12:00',
        arrivalTime: '12:07',
      },
      4
    );

    await pacedTrainSection.checkExceptionTooltip(
      4,
      frTranslations.timetable.occurrenceType.addedOccurrence,
      frTranslations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
    );

    await pacedTrainSection.checkOccurrenceMenuIcon(4);
    await pacedTrainSection.checkOccurrenceActionMenu({
      occurrenceIndex: 4,
      expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
      translations: frTranslations,
    });
  });

  test('Edit an indexed occurrence', async ({ page }) => {
    await pacedTrainSection.clickOnPacedTrain(0);
    await pacedTrainSection.checkOccurrenceMenuIcon(0);
    await pacedTrainSection.checkOccurrenceActionMenu({
      occurrenceIndex: 0,
      expectedButtons: CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
      translations: frTranslations,
    });
    await pacedTrainSection.clickOccurrenceMenuButton('edit');
    await operationalStudiesPage.setTrainScheduleName(EDITED_OCCURRENCE_NAME);
    await operationalStudiesPage.updateTimetableItem(frTranslations.pacedTrains.updatePacedTrain);
    await operationalStudiesPage.checkToastHasBeenLaunched(
      frTranslations.timetable.pacedTrainUpdated
    );

    await page.waitForLoadState('networkidle');

    await pacedTrainSection.checkExceptionTooltip(
      0,
      frTranslations.timetable.occurrenceType.editedOccurrence +
        frTranslations.timetable.occurrenceChangeGroup.train_name
    );
    await pacedTrainSection.checkOccurrenceMenuIcon(0);
    await pacedTrainSection.checkOccurrenceActionMenu({
      occurrenceIndex: 0,
      expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
      translations: frTranslations,
    });
    await pacedTrainSection.clickOccurrenceMenuButton('disable');
    await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
    await pacedTrainSection.checkOccurrenceMenuIcon(0);
    await pacedTrainSection.checkOccurrenceActionMenu({
      occurrenceIndex: 0,
      expectedButtons: DISABLED_OCCURRENCE_MENU_BUTTONS,
      translations: frTranslations,
    });
    await pacedTrainSection.clickOccurrenceMenuButton('enable');
    await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
    await pacedTrainSection.checkOccurrenceMenuIcon(0);
    await pacedTrainSection.checkOccurrenceActionMenu({
      occurrenceIndex: 0,
      expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
      translations: frTranslations,
    });
    await pacedTrainSection.clickOccurrenceMenuButton('restore');
    await pacedTrainSection.verifyOccurrenceName(0, INITIAL_OCCURRENCE_NAME);
  });
});
