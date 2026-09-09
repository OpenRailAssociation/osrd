import type { Scenario } from 'common/api/osrdEditoastApi';

import { trainScheduleScenarioName } from '../../assets/constants/project-const';
import {
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
} from '../../assets/constants/train-schedules-count';
import {
  EXPECTED_COUNTS,
  PACED_DETAILS,
  UNIQUE_TRAIN_DETAILS,
} from '../../assets/constants/train-schedules-details';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { getScenario } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frTimetableTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frTimetableTranslations,
  ...frCommonTranslations,
};

test.describe(
  'Timetable import and export',
  { tag: ['@op', '@train-schedules', '@import', '@export'] },
  () => {
    let scenarioToExport: Scenario;

    let downloadDir: string;
    let downloadedFilePath: string;

    const scenarioContext = setupScenarioFixture({
      scenarioNamePrefix: 'import-export-scenario',
      trains: [],
      scope: 'test',
    });

    test.beforeAll('Fetch the scenario to export', async () => {
      scenarioToExport = await getScenario(scenarioContext.study.id, trainScheduleScenarioName);
    });

    test.beforeEach('Verify timetable is empty', async ({ importExportPage }) => {
      await importExportPage.verifyTimetableIsEmpty(frTranslations.timetable.noTrainSchedule);
    });

    test(
      'Verify timetable is exported and imported correctly',
      { tag: '@smoke' },
      async ({ page, importExportPage, trainScheduleDetailSection }, testInfo) => {
        await test.step('Open scenario to export and verify initial train schedules count', async () => {
          const { project, study } = scenarioContext;
          await page.goto(
            `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioToExport.id}`
          );
          await trainScheduleDetailSection.verifyTotalTrainSchedulesLabel(frTranslations, {
            totalPacedTrainCount: TOTAL_PACED_TRAINS,
            totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
          });
        });

        await test.step('Select all train schedules and verify selection', async () => {
          await trainScheduleDetailSection.selectAllTrainSchedulesAndVerifySelection(
            frTranslations,
            {
              totalPacedTrainCount: TOTAL_PACED_TRAINS,
              totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
            }
          );
        });

        await test.step('Export train schedules and verify download', async () => {
          downloadDir = testInfo.outputDir;
          downloadedFilePath = await importExportPage.exportTrainSchedules(downloadDir);
        });

        await test.step('Import train schedules JSON and close dialog in the target scenario', async () => {
          const { project, study, scenarioItems } = scenarioContext;
          await page.goto(
            `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
          );
          await importExportPage.openImportTrainScheduleUploadDialog();
          await importExportPage.uploadTrainScheduleFile(
            downloadedFilePath,
            frTranslations.success
          );
        });

        await test.step('Verify train schedules count after import', async () => {
          await trainScheduleDetailSection.verifyTotalTrainSchedulesLabel(frTranslations, {
            totalPacedTrainCount: TOTAL_PACED_TRAINS,
            totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
          });
        });
      }
    );

    test(
      'Verify train schedules are imported correctly',
      { tag: '@smoke' },
      async ({ importExportPage, trainScheduleDetailSection, pacedTrainSection }) => {
        await test.step('Import train schedules JSON and return to scenario', async () => {
          await importExportPage.openImportTrainScheduleUploadDialog();
          await importExportPage.uploadTrainScheduleFile(
            './tests/assets/operation-studies/train-schedules.json',
            frTranslations.success
          );
        });

        await test.step('Verify train schedules count after import', async () => {
          await importExportPage.verifyTotalTrainSchedulesLabel(frTranslations, EXPECTED_COUNTS);
        });

        await test.step('Verify details for valid imported paced trains', async () => {
          await trainScheduleDetailSection.showTrainSchedulesDetails();
          await trainScheduleDetailSection.verifyPacedTrainDetails(0, PACED_DETAILS[0]);
          await pacedTrainSection.verifyOccurrencesCount(3, 0);
          await trainScheduleDetailSection.verifyPacedTrainDetails(1, PACED_DETAILS[1]);
          await pacedTrainSection.verifyOccurrencesCount(5, 3);
        });
        await test.step('Verify details for valid imported unique trains', async () => {
          await trainScheduleDetailSection.verifyUniqueTrainsDetails(UNIQUE_TRAIN_DETAILS);
        });
        await test.step('Verify invalid trains reasons', async () => {
          await trainScheduleDetailSection.verifyInvalidReasons([
            frTranslations.timetable.invalid.rolling_stock_not_found,
            frTranslations.timetable.invalid.incompatible_constraints,
            frTranslations.timetable.invalid.rolling_stock_not_found,
            frTranslations.timetable.invalid.incompatible_constraints,
            frTranslations.timetable.invalid.not_found_in_blocks,
          ]);
        });
      }
    );
  }
);
