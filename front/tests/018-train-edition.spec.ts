import type {
  Scenario,
  Project,
  Study,
  Infra,
  TrainScheduleBase,
  PacedTrain,
} from 'common/api/osrdEditoastApi';

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
import sendTrainSchedules from './utils/train-schedule';
import type {
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from './utils/types';

const enManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/en/operationalStudies/manageTrainSchedule.json'
);
const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/manageTrainSchedule.json'
);

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/en/operationalStudies/scenario.json'
);
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/scenario.json'
);

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const trainSchedulesJson = readJsonFile<TrainScheduleBase[]>(
  './tests/assets/train-schedule/train_schedules.json'
);
const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

const DURATION = '240';
const STEP = '20';
const EDITED_PACED_TRAIN_NAME = 'Paced train edited';

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
  let translations: ManageTrainScheduleTranslations &
    TimetableFilterTranslations &
    CommonTranslations;

  test.beforeEach('Fetch project, study and scenario with train schedule', async ({ page }) => {
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
    await sendTrainSchedules(
      scenarioItems.timetable_id,
      JSON.parse(JSON.stringify(trainSchedulesJson.slice(0, 1)))
    );
    await sendPacedTrains(
      scenarioItems.timetable_id,
      JSON.parse(JSON.stringify(pacedTrainsJson.slice(0, 1)))
    );

    translations = getTranslations({
      en: {
        ...enManageTrainScheduleTranslations,
        ...enScenarioTranslations,
        ...enCommonTranslations,
      },
      fr: {
        ...frManageTrainScheduleTranslations,
        ...frScenarioTranslations,
        ...frCommonTranslations,
      },
    });

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
    await page.waitForLoadState('networkidle');

    pacedTrainSection = new PacedTrainSection(page);
    scenarioTimetableSection = new ScenarioTimetableSection(page);
    operationalStudiesPage = new OperationalStudiesPage(page);
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test('Edit a paced train', async () => {
    await operationalStudiesPage.checkPacedTrainSwitch();

    await pacedTrainSection.editPacedTrain();

    await operationalStudiesPage.setTimeRangeDuration(DURATION);
    await operationalStudiesPage.setCadence(STEP);
    await operationalStudiesPage.setTrainScheduleName(EDITED_PACED_TRAIN_NAME);

    await operationalStudiesPage.updateTimetableItem(translations.updatePacedTrain);

    await operationalStudiesPage.checkToastHasBeenLaunched(translations.pacedTrainUpdated);

    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: 1,
      totalTrainScheduleCount: 1,
    });
    await pacedTrainSection.verifyPacedTrainItemDetails(
      {
        name: EDITED_PACED_TRAIN_NAME,
        startTime: '03:00',
        labels: [],
        duration: DURATION,
        step: STEP,
      },
      0,
      { pacedTrainCardAlreadyOpen: true }
    );
  });

  test('Turn paced train into train schedule', async () => {
    await operationalStudiesPage.checkPacedTrainSwitch();

    await pacedTrainSection.editPacedTrain();

    await operationalStudiesPage.turnPacedTrainIntoTrainSchedule(translations);

    await operationalStudiesPage.checkToastHasBeenLaunched(translations.pacedTrainUpdated);

    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: 0,
      totalTrainScheduleCount: 2,
    });
  });

  test('Turn a train schedule into a paced train', async () => {
    await operationalStudiesPage.checkPacedTrainSwitch();

    await scenarioTimetableSection.clickOnEditTrain(1);

    await operationalStudiesPage.turnTrainScheduleIntoPacedTrain(translations);

    await operationalStudiesPage.checkToastHasBeenLaunched(translations.trainScheduleUpdated);

    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: 2,
      totalTrainScheduleCount: 0,
    });
  });
});
