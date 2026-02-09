import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemScenarioName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
} from '../../assets/constants/timetable-items-count';
import {
  EXPECTED_COUNTS,
  PACED_DETAILS,
  UNIQUE_TRAIN_DETAILS,
} from '../../assets/constants/timetable-items-details';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getScenario, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
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

test.describe('@op @timetable-items @import @export', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let scenarioToExport: Scenario;
  let infra: Infra;

  let downloadDir: string;
  let downloadedFilePath: string;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    scenarioToExport = await getScenario(study.id, timetableItemScenarioName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario ', async ({ page, importExportPage }) => {
    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenario = (
        await createScenario(
          generateUniqueName('import-export-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Verify timetable is empty', async () => {
      await importExportPage.verifyTimetableIsEmpty(frTranslations.timetable.noItem);
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  test('@smoke Verify timetable is exported and imported correctly', async ({
    page,
    importExportPage,
    timetableItemDetailSection,
  }, testInfo) => {
    await test.step('Open scenario to export and verify initial timetable items count', async () => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioToExport.id}`
      );
      await timetableItemDetailSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });

    await test.step('Select all timetable items and verify selection', async () => {
      await timetableItemDetailSection.selectAllTimetableItemsAndVerifySelection(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });

    await test.step('Export timetable items and verify download', async () => {
      downloadDir = testInfo.outputDir;
      downloadedFilePath = await importExportPage.exportTimetableItems(downloadDir);
    });

    await test.step('Import timetable items JSON and close dialog in the target scenario', async () => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await importExportPage.openImportTimetableItemUploadDialog();
      await importExportPage.uploadTimetableItemFile(downloadedFilePath, frTranslations.success);
    });

    await test.step('Verify timetable items count after import', async () => {
      await timetableItemDetailSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });
  });

  test('@smoke Verify timetable items are imported correctly', async ({
    importExportPage,
    timetableItemDetailSection,
    pacedTrainSection,
  }) => {
    await test.step('Import timetable items JSON and return to scenario', async () => {
      await importExportPage.openImportTimetableItemUploadDialog();
      await importExportPage.uploadTimetableItemFile(
        './tests/assets/operation-studies/timetable-items.json',
        frTranslations.success
      );
    });

    await test.step('Verify timetable items count after import', async () => {
      await importExportPage.verifyTotalItemsLabel(frTranslations, EXPECTED_COUNTS);
    });

    await test.step('Verify details for valid imported paced trains', async () => {
      await timetableItemDetailSection.showTimetableItemsDetails();
      await timetableItemDetailSection.verifyPacedTrainDetails(0, PACED_DETAILS[0]);
      await pacedTrainSection.verifyOccurrencesCount(3, 0);
      await timetableItemDetailSection.verifyPacedTrainDetails(1, PACED_DETAILS[1]);
      await pacedTrainSection.verifyOccurrencesCount(5, 3);
    });
    await test.step('Verify details for valid imported unique trains', async () => {
      await timetableItemDetailSection.verifyUniqueTrainsDetails(UNIQUE_TRAIN_DETAILS);
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
