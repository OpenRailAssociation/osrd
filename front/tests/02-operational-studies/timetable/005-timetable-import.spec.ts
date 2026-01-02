import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  EXPECTED_COUNTS,
  PACED_DETAILS,
  TRAIN_SCHEDULE_DETAILS,
} from '../../assets/constants/timetable-items-details';
import test from '../../logging-fixture';
import ImportPage from '../../pages/import-page';
import PacedTrainSection from '../../pages/operational-studies/paced-train-section';
import TimetableItemDetailSection from '../../pages/operational-studies/timetable-items-details-section';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import readJsonFile from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frTimetableTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frTimetableTranslations,
  ...frCommonTranslations,
};

test.describe('@op @timetable-items @import', () => {
  let importPage: ImportPage;
  let timetableItemDetailSection: TimetableItemDetailSection;
  let pacedTrainSection: PacedTrainSection;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario ', async ({ page }) => {
    importPage = new ImportPage(page);
    timetableItemDetailSection = new TimetableItemDetailSection(page);
    pacedTrainSection = new PacedTrainSection(page);

    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenario = (
        await createScenario(generateUniqueName('import-scenario'), project.id, study.id, infra.id)
      ).scenario;
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  test('Verify timetable items are imported correctly', async () => {
    await test.step('Verify timetable is empty', async () => {
      await importPage.verifyTimetableIsEmpty(frTranslations.timetable.noItem);
    });
    await test.step('Import timetable items JSON and return to scenario', async () => {
      await importPage.openImportTimetableItemForm();
      await importPage.openUploadDialog();
      await importPage.uploadTimetableItemFile(
        './tests/assets/operation-studies/timetable-items.json',
        EXPECTED_COUNTS
      );
      await importPage.launchTimetableItemImport(frTranslations.success);
      await importPage.returnSimulationResult();
    });

    await test.step('Verify timetable items count after import', async () => {
      await importPage.verifyTotalItemsLabel(frTranslations, EXPECTED_COUNTS);
    });

    await test.step('Verify details for valid imported paced trains', async () => {
      await timetableItemDetailSection.showTimetableItemsDetails();
      await timetableItemDetailSection.verifyPacedTrainDetails(0, PACED_DETAILS[0]);
      await pacedTrainSection.verifyOccurrencesCount(3, 0);
      await timetableItemDetailSection.verifyPacedTrainDetails(1, PACED_DETAILS[1]);
      await pacedTrainSection.verifyOccurrencesCount(5, 3);
    });
    await test.step('Verify details for valid imported train schedules', async () => {
      await timetableItemDetailSection.verifyTrainSchedulesDetails(TRAIN_SCHEDULE_DETAILS);
    });
    await test.step('Verify invalid items reasons', async () => {
      await timetableItemDetailSection.verifyInvalidReasons([
        frTranslations.timetable.invalid.rolling_stock_not_found,
        frTranslations.timetable.invalid.incompatible_constraints,
        frTranslations.timetable.invalid.rolling_stock_not_found,
        frTranslations.timetable.invalid.incompatible_constraints,
        frTranslations.timetable.invalid.not_found_in_blocks,
      ]);
    });
  });
});
