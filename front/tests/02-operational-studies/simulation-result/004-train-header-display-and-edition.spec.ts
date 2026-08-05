import { expect } from '@playwright/test';

import { improbableRollingStockName } from '../../assets/constants/project-const';
import {
  frRollingStockTranslations,
  frTranslations,
  NO_COMPOSITION_CODE_VALUE,
  pacedTrain,
  SCENARIO_NAME_PREFIX,
  uniqueTrain,
} from '../../assets/constants/train-header-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';

test.describe(
  'Schedule sheet header - display and edition',
  { tag: ['@op', '@train-header'] },
  () => {
    //TODO: remove ignorePageErrors when issue #13066 is resolved
    test.use({ ignorePageErrors: true });

    setupScenarioFixture({
      scenarioNamePrefix: SCENARIO_NAME_PREFIX,
      trains: [uniqueTrain, pacedTrain],
      scope: 'test',
    });

    /** *************** Test 1 **************** */
    test(
      'displays the collapsed and expanded header for a unique train',
      { tag: '@smoke' },
      async ({ headerPage }) => {
        await test.step('The collapsed header shows the date, category, rolling stock, speed limit tag and margin', async () => {
          await headerPage.verifyKindBadgeAbsent();
          await headerPage.verifyCadenceSummaryAbsent();
          await headerPage.verifyCollapsedSummary({
            departureDate: '17/10/2024',
            category: frRollingStockTranslations.shortCategoriesOptions.FREIGHT_TRAIN,
            rollingStock: uniqueTrain.rolling_stock_name,
            compositionCode: uniqueTrain.speed_limit_tag ?? '',
            recoveryMargin: frTranslations.trainHeader.allowances.mareco,
          });
        });

        await test.step('Expand the header: all fields show the train values', async () => {
          await headerPage.expandHeader();
          await headerPage.verifyExpandedFormFields({
            name: uniqueTrain.train_name,
            departureDate: '17/10/24',
            initialVelocity: '100',
            category: 'main:FREIGHT_TRAIN',
            rollingStock: uniqueTrain.rolling_stock_name,
            compositionCode: uniqueTrain.speed_limit_tag ?? '',
            recoveryMargin: uniqueTrain.constraint_distribution,
            comfort: uniqueTrain.comfort ?? '',
            useElectricalProfiles: uniqueTrain.options?.use_electrical_profiles ?? false,
            labels: uniqueTrain.labels ?? [],
          });
        });
      }
    );

    /** *************** Test 2 **************** */
    test(
      'displays the collapsed and expanded header for a service train (mission)',
      { tag: '@smoke' },
      async ({ headerPage, pacedTrainSection }) => {
        await test.step('Select the service train', async () => {
          await pacedTrainSection.selectPacedTrainModel(0);
        });

        await test.step('The collapsed header shows the service train badge, cadence/window summary, category, rolling stock and margin', async () => {
          await headerPage.verifyKindBadge(frTranslations.trainHeader.serviceModelTrain);
          await headerPage.verifyCollapsedSummary({
            cadence: '65',
            departureDate: '18/10/2024',
            category: frRollingStockTranslations.shortCategoriesOptions.FREIGHT_TRAIN,
            rollingStock: pacedTrain.rolling_stock_name,
            recoveryMargin: frTranslations.trainHeader.allowances.mareco,
          });
        });

        await test.step('Expand the header: cadence, repetition window and added occurrences are shown', async () => {
          await headerPage.expandHeader();
          await expect(headerPage.serviceCadenceInput).toHaveValue('65');
          await expect(headerPage.serviceWindowHourInput).toHaveValue('4');
          await expect(headerPage.serviceWindowMinuteInput).toHaveValue('10');
          await headerPage.verifyExtraOccurrencesToggleLabel(1);
        });

        await test.step('All train fields show the service train values', async () => {
          await headerPage.verifyExpandedFormFields({
            name: pacedTrain.train_name,
            departureDate: '18/10/24',
            initialVelocity: '0',
            category: 'main:FREIGHT_TRAIN',
            rollingStock: pacedTrain.rolling_stock_name,
            compositionCode: pacedTrain.speed_limit_tag ?? NO_COMPOSITION_CODE_VALUE,
            recoveryMargin: pacedTrain.constraint_distribution,
            comfort: pacedTrain.comfort ?? '',
            useElectricalProfiles: pacedTrain.options?.use_electrical_profiles ?? false,
            labels: pacedTrain.labels ?? [],
          });
        });
      }
    );

    /** *************** Test 3 **************** */
    test(
      "Editing a unique train's fields",
      { tag: '@smoke' },
      async ({ headerPage, scenarioTimetableSection }) => {
        await test.step('Expand the header of the selected unique train', async () => {
          await headerPage.expandHeader();
        });

        await test.step('Edit general information', async () => {
          await headerPage.setName('Unique train renamed');
          await headerPage.selectCategory('main:FREIGHT_TRAIN');
          await headerPage.setRollingStock(improbableRollingStockName);
          await headerPage.selectCompositionCode('MA80');
          await headerPage.selectComfort('AIR_CONDITIONING');
          await headerPage.setInitialVelocity('20');
          await headerPage.selectRecoveryMargin('MARECO');
          await headerPage.addTag('e2e-header-tag');
          await headerPage.toggleElectricalProfiles(false);

          await headerPage.verifyExpandedFormFields({
            name: 'Unique train renamed',
            departureDate: '17/10/24',
            initialVelocity: '20',
            category: 'main:FREIGHT_TRAIN',
            rollingStock: improbableRollingStockName,
            compositionCode: 'MA80',
            recoveryMargin: 'MARECO',
            comfort: 'AIR_CONDITIONING',
            useElectricalProfiles: false,
            labels: [...(uniqueTrain.labels ?? []), 'e2e-header-tag'],
          });
        });

        await test.step('The timetable item reflects the changes', async () => {
          await scenarioTimetableSection.verifyTrainName('Unique train renamed');
          await scenarioTimetableSection.verifyTrainScheduleDepartureTime('21:05');
          await scenarioTimetableSection.getTrainScheduleArrivalTime('00:17');
        });
      }
    );

    /** *************** Test 4 **************** */
    test(
      "Editing a service train's fields",
      { tag: '@smoke' },
      async ({ headerPage, scenarioTimetableSection, pacedTrainSection }) => {
        await test.step('Select the paced train and expand the header', async () => {
          await pacedTrainSection.selectPacedTrainModel(0);
          await headerPage.expandHeader();
        });

        await test.step('Edit general information', async () => {
          await headerPage.setName('Paced train renamed');
          await headerPage.selectCategory('main:FREIGHT_TRAIN');
          await headerPage.setRollingStock(improbableRollingStockName);
          await headerPage.selectCompositionCode('MA90');
          await headerPage.selectComfort('AIR_CONDITIONING');
          await headerPage.setInitialVelocity('80');
          await headerPage.selectRecoveryMargin('STANDARD');
          await headerPage.addTag('e2e-header-tag');
          await headerPage.toggleElectricalProfiles(true);

          await headerPage.verifyExpandedFormFields({
            name: 'Paced train renamed',
            departureDate: '18/10/24',
            initialVelocity: '80',
            category: 'main:FREIGHT_TRAIN',
            rollingStock: improbableRollingStockName,
            compositionCode: 'MA90',
            recoveryMargin: 'STANDARD',
            comfort: 'AIR_CONDITIONING',
            useElectricalProfiles: true,
            labels: [...(pacedTrain.labels ?? []), 'e2e-header-tag'],
          });
        });

        await test.step('The timetable item reflects the edited service train', async () => {
          await scenarioTimetableSection.verifyPacedTrainName('Paced train renamed', 1);
          await scenarioTimetableSection.verifyPacedTrainInterval(65, 1);
          await pacedTrainSection.expandPacedTrainOccurrenceList(0);
          await pacedTrainSection.verifyOccurrenceArrivalTimes([
            '01:11',
            '02:07',
            '05:23',
            '05:53',
            '06:22',
          ]);
        });
      }
    );

    /** *************** Test 5 **************** */
    test('Service train cadence/window edition', async ({
      headerPage,
      scenarioTimetableSection,
      pacedTrainSection,
    }) => {
      await test.step('Select the service train and expand the header', async () => {
        await pacedTrainSection.selectPacedTrainModel(0);
        await headerPage.expandHeader();
        await headerPage.verifyExtraOccurrencesToggleLabel(1);
      });

      await test.step('Modify cadence: cancelling restores the previous value', async () => {
        await headerPage.setServiceCadenceMinutes('45');
        await headerPage.verifyServiceChangeDialogVisible();
        await headerPage.cancelServiceChange();
        await expect(headerPage.serviceCadenceInput).toHaveValue('65');
      });

      await test.step('Modify the repetition range: a confirmation updates the value', async () => {
        await headerPage.setServiceWindow('03', '00');
        await headerPage.verifyServiceChangeDialogVisible();
        await headerPage.confirmServiceChange();
        await expect(headerPage.serviceWindowHourInput).toHaveValue('3');
        await expect(headerPage.serviceWindowMinuteInput).toHaveValue('00');
      });

      await test.step('The added exception is cleared', async () => {
        await headerPage.verifyExtraOccurrencesToggleLabel(0);
        await headerPage.toggleExtraOccurrences();
        await headerPage.expectExtraOccurrenceRowCount(0);
        await headerPage.collapseHeader();
        await headerPage.verifyCollapsedSummary({ cadence: '65' });
      });

      await test.step('The timetable reflects the 65min cadence over the 3h window with no exceptions', async () => {
        await scenarioTimetableSection.verifyPacedTrainInterval(65, 1);
        await pacedTrainSection.expandPacedTrainOccurrenceList(0);
        await pacedTrainSection.expectOccurrencesListLength(3);
        await pacedTrainSection.verifyOccurrenceArrivalTimes(['01:10', '02:15', '03:20']);
      });
    });
  }
);
