import { expect } from '@playwright/test';

import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { improbableRollingStockName } from '../../assets/constants/project-const';
import { allSettingsData } from '../../assets/operation-studies/simulation-settings/all-settings';
import { electricalProfileOffData } from '../../assets/operation-studies/simulation-settings/electrical-profiles/electrical-profile-off';
import { electricalProfileOnData } from '../../assets/operation-studies/simulation-settings/electrical-profiles/electrical-profile-on';
import { linearMarginData } from '../../assets/operation-studies/simulation-settings/margin/linear-margin';
import { marecoMarginData } from '../../assets/operation-studies/simulation-settings/margin/mareco-margin';
import { speedLimitTagOffData } from '../../assets/operation-studies/simulation-settings/speed-limit-tag/speed-limit-tag-off';
import { speedLimitTagOnData } from '../../assets/operation-studies/simulation-settings/speed-limit-tag/speed-limit-tag-on';
import {
  FREIGHT_TRAIN,
  TRAIN_NAME,
  TRAIN_START_TIME,
} from '../../assets/operation-studies/train-const';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { deleteApiRequest, getInfra, setElectricalProfile } from '../../utils/api-utils';
import { cleanWhitespace } from '../../utils/data-normalizer';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import type { FlatTranslations } from '../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

test.describe('Simulation settings tab', { tag: ['@op', '@simulation-settings-tab'] }, () => {
  test.slow(); // TODO remove this once this PR is merged: #16969
  let electricalProfileSet: ElectricalProfileSet;
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  type TranslationKeys = keyof typeof frTranslations;

  type CellData = {
    stationName: string;
    header: TranslationKeys;
    value: string;
    marginForm?: string;
  };

  test.beforeAll('Add electrical profile via API and fetch infrastructure', async () => {
    electricalProfileSet = await setElectricalProfile();
    infra = await getInfra();
  });

  test.afterAll('Delete the electrical profile', async () => {
    if (electricalProfileSet?.id)
      await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  test.beforeEach(async ({ page, operationalStudiesPage, rollingStockSelector, routeTab }) => {
    await test.step('Create then navigate to scenario page', async () => {
      ({ project, study, scenario } = await createScenario(
        undefined,
        null,
        null,
        null,
        electricalProfileSet.id
      ));
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Add a new unique train, set its properties and perform pathfinding', async () => {
      await operationalStudiesPage.openTrainScheduleForm();
      await operationalStudiesPage.setTrainScheduleName(TRAIN_NAME);
      await rollingStockSelector.selectRollingStock(improbableRollingStockName);
      await operationalStudiesPage.setTrainScheduleStartTime(TRAIN_START_TIME);
      await operationalStudiesPage.selectCategory(FREIGHT_TRAIN.category);
      await operationalStudiesPage.openRouteTab();
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'SES',
        viaTrigram: 'MWS',
      });
      await operationalStudiesPage.openTimesAndStopsTab();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test('Activate electrical profiles', async ({
    browserName,
    timesAndStopsTab,
    operationalStudiesPage,
    simulationSettingsTab,
    scenarioTimetableSection,
    opSimulationResultPage,
    timeAndStopSimulationOutputs,
  }) => {
    const cell: CellData = { stationName: 'Mid_East_station', header: 'stopTime', value: '124' };
    const translatedHeader = cleanWhitespace(frTranslations[cell.header]);

    await test.step('Fill Times & Stops input', async () => {
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value
      );
    });

    await test.step('Activate electrical profiles + Mareco margin', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.checkElectricalProfile();
      await simulationSettingsTab.checkMarecoMargin();
    });

    await test.step('Create unique train and verify (electrical profile ON)', async () => {
      await operationalStudiesPage.createTrainSchedule();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
      await scenarioTimetableSection.verifyTrainColor(FREIGHT_TRAIN.color);
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileActivated.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(electricalProfileOnData);
      await opSimulationResultPage.setTrainListVisible(false);
    });

    await test.step('Deactivate electrical profiles and verify (OFF)', async () => {
      await scenarioTimetableSection.editTrainSchedule();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await operationalStudiesPage.submitTrainScheduleEdit();
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileDisabled.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(electricalProfileOffData);
      await opSimulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
    });
  });

  /** *************** Test 2 **************** */
  test('Add speed limit tag', async ({
    browserName,
    timesAndStopsTab,
    operationalStudiesPage,
    simulationSettingsTab,
    scenarioTimetableSection,
    opSimulationResultPage,
    timeAndStopSimulationOutputs,
  }) => {
    const cell: CellData = { stationName: 'Mid_East_station', header: 'stopTime', value: '124' };
    const translatedHeader = cleanWhitespace(frTranslations[cell.header]);

    await test.step('Fill Times & Stops input', async () => {
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value
      );
    });

    await test.step('Enable Mareco margin + speed limit tag (HLP), disable electrical profile', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await simulationSettingsTab.checkMarecoMargin();
      await simulationSettingsTab.selectSpeedLimitTagOption('E32C');
    });

    await test.step('Create unique train and verify (speed limit tag ON)', async () => {
      await operationalStudiesPage.createTrainSchedule();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:49');
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagActivated.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(speedLimitTagOnData);
      await opSimulationResultPage.setTrainListVisible(false);
    });

    await test.step('Remove speed limit tag and verify (speed limit tag OFF)', async () => {
      await scenarioTimetableSection.editTrainSchedule();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.selectSpeedLimitTagOption('__PLACEHOLDER__');
      await operationalStudiesPage.submitTrainScheduleEdit();
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagDisabled.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(speedLimitTagOffData);
      await opSimulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
    });
  });

  /** *************** Test 3 **************** */
  test('Activate linear and mareco margin', async ({
    browserName,
    timesAndStopsTab,
    operationalStudiesPage,
    simulationSettingsTab,
    scenarioTimetableSection,
    opSimulationResultPage,
    timeAndStopSimulationOutputs,
  }) => {
    const inputTableData: CellData[] = [
      { stationName: 'Mid_East_station', header: 'stopTime', value: '124' },
      {
        stationName: 'West_station',
        header: 'theoreticalMargin',
        value: '10%',
        marginForm: '% ou min/100km',
      },
    ];

    await test.step('Fill Times & Stops inputs (stop time + theoretical margin)', async () => {
      for (const cell of inputTableData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
    });

    await test.step('Enable Linear margin (electrical OFF)', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await simulationSettingsTab.activateLinearMargin();
    });

    await test.step('Create unique train and verify (Linear)', async () => {
      await operationalStudiesPage.createTrainSchedule();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:51');
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-LinearMargin.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(linearMarginData);
      await opSimulationResultPage.setTrainListVisible(false);
    });

    await test.step('Edit to Mareco margin and verify', async () => {
      await scenarioTimetableSection.editTrainSchedule();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.activateMarecoMargin();
      await operationalStudiesPage.submitTrainScheduleEdit();
      await opSimulationResultPage.setTrainListVisible();

      await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-MarecoMargin.png'
        );
      }
      await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(marecoMarginData);
      await opSimulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:51');
    });
  });

  /** *************** Test 4 **************** */
  test(
    'Add all the simulation settings',
    { tag: '@smoke' },
    async ({
      browserName,
      timesAndStopsTab,
      operationalStudiesPage,
      simulationSettingsTab,
      scenarioTimetableSection,
      opSimulationResultPage,
      timeAndStopSimulationOutputs,
    }) => {
      const inputTableData: CellData[] = [
        { stationName: 'Mid_East_station', header: 'stopTime', value: '124' },
        {
          stationName: 'West_station',
          header: 'theoreticalMargin',
          value: '5%',
          marginForm: '% ou min/100km',
        },
      ];

      await test.step('Fill Times & Stops inputs', async () => {
        for (const cell of inputTableData) {
          const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
          await timesAndStopsTab.fillTableCellByStationAndHeader(
            cell.stationName,
            translatedHeader,
            cell.value,
            cell.marginForm
          );
        }
      });

      await test.step('Enable Linear margin + electrical profile + speed limit tag', async () => {
        await operationalStudiesPage.openSimulationSettingsTab();
        await simulationSettingsTab.checkElectricalProfile();
        await simulationSettingsTab.activateLinearMargin();
        await simulationSettingsTab.selectSpeedLimitTagOption('E32C');
      });

      await test.step('Create unique train and verify outputs (all settings ON)', async () => {
        await operationalStudiesPage.createTrainSchedule();
        await operationalStudiesPage.closeToastNotification();
        await operationalStudiesPage.returnSimulationResult();
        await opSimulationResultPage.setTrainListVisible();

        await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
        await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        if (browserName === 'chromium') {
          await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
            'SpeedSpaceChart-AllSettingsEnabled.png'
          );
        }
        await timeAndStopSimulationOutputs.verifyTimesStopsTableContent(allSettingsData);
        await opSimulationResultPage.setTrainListVisible(false);
        await scenarioTimetableSection.getTrainScheduleArrivalTime('11:50');
      });
    }
  );
});
