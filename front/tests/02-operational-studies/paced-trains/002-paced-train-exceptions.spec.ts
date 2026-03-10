import { expect } from '@playwright/test';

import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  fastRollingStockName,
  slowRollingStockName,
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import { ADDED_EXCEPTION_MENU_BUTTONS } from '../../assets/paced-train/const';
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
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations = {
  ...frManageTimetableItemTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Paced train exceptions', { tag: ['@op', '@paced-trains', '@exceptions'] }, () => {
  let project: Project;
  let study: Study;
  let infra: Infra;

  let scenarioItems: Scenario;

  test.beforeAll('Setup project, study, infra and create scenario with paced trains', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
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
  });

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
  test(
    'Edit a paced train and handle exceptions',
    { tag: '@smoke' },
    async ({
      pacedTrainSection,
      scenarioTimetableSection,
      rollingStockSelector,
      operationalStudiesPage,
    }) => {
      const editedPacedTrainData = trains[5];

      await test.step('Open action buttons for paced train at index 5', async () => {
        await pacedTrainSection.getActionButtonsLocators({
          itemIndex: 5,
          itemType: 'paced-train',
          withExceptions: true,
          checkVisibility: true,
        });
      });

      await test.step('Edit the paced train', async () => {
        await pacedTrainSection.openPacedTrainEditor(5);
        await scenarioTimetableSection.verifyEditTimetableItemButtonVisibility();
      });

      await test.step('Update rolling stock', async () => {
        await rollingStockSelector.openRollingstockModal();
        await rollingStockSelector.searchRollingstock(fastRollingStockName);
        await rollingStockSelector.selectRollingStockCard({
          name: fastRollingStockName,
          confirmSelection: true,
        });
        await expect(rollingStockSelector.selectedRollingStockName).toHaveText(
          fastRollingStockName
        );
      });

      await test.step('Update departure time and submit edit', async () => {
        await operationalStudiesPage.setTimetableItemStartTime('12:00');
        await operationalStudiesPage.submitTimetableItemEdit();
        await operationalStudiesPage.checkToastHasBeenLaunched(
          frTranslations.timetable.pacedTrainUpdated
        );
      });

      await test.step('Verify all occurrences (4 occurrences including 1 added exception)', async () => {
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name}/+`,
            startTime: '21:00',
            arrivalTime: '21:03',
            rollingStock: fastRollingStockName,
          },
          0
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 1`,
            startTime: '12:00',
            arrivalTime: '12:07',
            rollingStock: slowRollingStockName,
          },
          1
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 3`,
            startTime: '13:00',
            arrivalTime: '13:03',
            rollingStock: fastRollingStockName,
          },
          2
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 5`,
            startTime: '14:00',
            arrivalTime: '14:03',
            rollingStock: fastRollingStockName,
          },
          3
        );
      });

      await test.step('Reset all exceptions', async () => {
        await pacedTrainSection.resetAllPacedTrainExceptions(5);
      });

      await test.step('Verify occurrences after reset', async () => {
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 1`,
            startTime: '12:00',
            arrivalTime: '12:03',
            rollingStock: editedPacedTrainData.rolling_stock_name,
          },
          0
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 3`,
            startTime: '13:00',
            arrivalTime: '13:03',
            rollingStock: editedPacedTrainData.rolling_stock_name,
          },
          1
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 5`,
            startTime: '14:00',
            arrivalTime: '14:03',
            rollingStock: editedPacedTrainData.rolling_stock_name,
          },
          2
        );
      });

      await test.step('Check action buttons count after reset (4 buttons instead of 5)', async () => {
        await pacedTrainSection.getActionButtonsLocators({
          itemIndex: 5,
          itemType: 'paced-train',
          checkVisibility: true,
        });
      });
    }
  );

  /** *************** Test 2 **************** */
  test('Modify a paced train and create added exception', async ({
    pacedTrainSection,
    scenarioTimetableSection,
    operationalStudiesPage,
  }) => {
    const editedPacedTrainData = trains[1];

    await test.step('Edit paced train at index 1', async () => {
      await pacedTrainSection.openPacedTrainEditor(1);
      await scenarioTimetableSection.verifyEditTimetableItemButtonVisibility();
    });

    await test.step('Check inputs before editing paced train', async () => {
      await operationalStudiesPage.checkInputsBeforeEditingAPacedTrain(
        frTranslations,
        editedPacedTrainData.paced!.time_window,
        editedPacedTrainData.paced!.interval
      );
    });

    await test.step('Add an exception for the paced train', async () => {
      await operationalStudiesPage.createPacedTrainException('2025-08-08', '12:00:00');
    });

    await test.step('Submit edit and verify the occurrences count (5)', async () => {
      await operationalStudiesPage.submitTimetableItemEdit();
      await pacedTrainSection.expectOccurrencesListLength(5);
      await operationalStudiesPage.checkToastHasBeenLaunched(
        frTranslations.timetable.pacedTrainUpdated
      );
    });

    await test.step('Verify details of the added exception occurrence (index 4)', async () => {
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name}/+`,
          startTime: '12:00',
          arrivalTime: '12:07',
        },
        4
      );
    });

    await test.step('Check tooltip and occurrence menu for added exception', async () => {
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
  });
});
