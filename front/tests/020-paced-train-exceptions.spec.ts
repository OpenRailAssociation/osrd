import type { Scenario, Project, Study, Infra, PacedTrain } from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, getTranslations, waitForInfraStateToBeCached } from './utils';
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

const enManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/en/operational-studies.json').manageTrainSchedule;
const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/en/operational-studies.json').main;
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

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
  let translations: ManageTrainScheduleTranslations & TimetableFilterTranslations;

  test.beforeEach('Fetch project, study and scenario with train schedule', async ({ page }) => {
    [pacedTrainSection, scenarioTimetableSection, operationalStudiesPage] = [
      new PacedTrainSection(page),
      new ScenarioTimetableSection(page),
      new OperationalStudiesPage(page),
    ];

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
    await sendPacedTrains(
      scenarioItems.timetable_id,
      JSON.parse(JSON.stringify(pacedTrainsJson.slice(0, 1)))
    );

    translations = getTranslations({
      en: {
        ...enManageTrainScheduleTranslations,
        ...enScenarioTranslations,
      },
      fr: {
        ...frManageTrainScheduleTranslations,
        ...frScenarioTranslations,
      },
    });

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test('Modify a paced train and create added exception', async () => {
    const editedPacedTrainData = pacedTrainsJson[0];

    await pacedTrainSection.editPacedTrain();

    await scenarioTimetableSection.verifyEditTrainScheduleButtonVisibility();

    await operationalStudiesPage.checkInputsBeforeEditingAPacedTrain(
      translations,
      editedPacedTrainData.paced.time_window,
      editedPacedTrainData.paced.interval
    );

    await operationalStudiesPage.createPacedTrainException('2025-08-08', '12:00:00');

    await operationalStudiesPage.validateAndCloseTrainEdition();

    await operationalStudiesPage.checkToastHasBeenLaunched(
      translations.timetable.pacedTrainUpdated
    );

    await pacedTrainSection.verifyOccurrenceDetails(
      {
        name: `${editedPacedTrainData.train_name}/+`,
        startTime: '12:00',
        arrivalTime: '12:07',
      },
      2
    );

    await pacedTrainSection.checkExceptionTooltip(
      2,
      translations.timetable.occurrenceType.addedOccurrence,
      translations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
    );

    await pacedTrainSection.checkOccurrenceMenuIcon(2);
    await pacedTrainSection.checkOccurrenceActionMenu(
      2,
      ['edit', 'project', 'delete'],
      translations
    );
  });
});
