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
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import { PLACEHOLDER } from '../itineraryModal/itinerary-modal.consts';

test.describe('Simulation settings tab', { tag: ['@op', '@simulation-settings-tab'] }, () => {
  //TODO: remove ignorePageErrors when issue #13066 is resolved
  test.use({ ignorePageErrors: true });

  let electricalProfileSet: ElectricalProfileSet;
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Add electrical profile via API and fetch infrastructure', async () => {
    electricalProfileSet = await setElectricalProfile();
    infra = await getInfra();
  });

  test.afterAll('Delete the electrical profile', async () => {
    if (electricalProfileSet?.id)
      await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  test.beforeEach(
    async ({
      page,
      scenarioTimetableSection,
      itineraryModalPage,
      headerPage,
      timesStopsTablePage,
    }) => {
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

      await test.step('Create a unique train with an explicit route (WS - MWS - MES - SES)', async () => {
        await scenarioTimetableSection.openItineraryModal();
        await itineraryModalPage.fillRollingStock(improbableRollingStockName);
        await itineraryModalPage.checkRollingStock(
          `${improbableRollingStockName} - UniqueRollingStock`
        );
        await itineraryModalPage.checkCategory(FREIGHT_TRAIN.category);
        await itineraryModalPage.fillTrainName(TRAIN_NAME);
        await itineraryModalPage.launchRocketSearch('WS MWS MES SES');
        await itineraryModalPage.createTrain();
        await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
        await itineraryModalPage.verifyTrainColorInTimetable(FREIGHT_TRAIN.color);
      });

      await test.step('Set the Mid_East_station stop duration, common to every scenario', async () => {
        await timesStopsTablePage.verifyTimesStopsDataSheetVisibility();
        await timesStopsTablePage.verifyDataRowCount(4);
        // The arrival time of day is set here, from the table, rather than through the header.
        const originRow = timesStopsTablePage.getRow(0);
        await timesStopsTablePage.editRequestedArrival(originRow, TRAIN_START_TIME);
        await timesStopsTablePage.waitForSimulation();
        const midEastStationRow = timesStopsTablePage.getRow(2);
        // Duration cell fills MM then SS (4 digits): "0204" -> 2min 4s.
        await timesStopsTablePage.editStopDuration(midEastStationRow, '0204');
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Select the train and expand the header', async () => {
        await scenarioTimetableSection.selectUniqueTrainModel(0);
        await headerPage.expandHeader();
      });
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test('Activate electrical profiles', async ({
    browserName,
    headerPage,
    scenarioTimetableSection,
    opSimulationResultPage,
    timesStopsTablePage,
  }) => {
    await test.step('Activate electrical profiles + Mareco margin', async () => {
      await headerPage.toggleElectricalProfiles(true);
      await headerPage.selectRecoveryMargin('MARECO');
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step('Verify results (electrical profile ON)', async () => {
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileActivated.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(electricalProfileOnData);
    });

    await test.step('Deactivate electrical profiles and verify (OFF)', async () => {
      await headerPage.toggleElectricalProfiles(false);
      await timesStopsTablePage.waitForSimulation();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileDisabled.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(electricalProfileOffData);
    });
  });

  /** *************** Test 2 **************** */
  test('Add speed limit tag', async ({
    browserName,
    headerPage,
    scenarioTimetableSection,
    opSimulationResultPage,
    timesStopsTablePage,
  }) => {
    await test.step('Enable Mareco margin + speed limit tag (E32C), disable electrical profile', async () => {
      await headerPage.toggleElectricalProfiles(false);
      await headerPage.selectRecoveryMargin('MARECO');
      await headerPage.selectCompositionCode('E32C');
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step('Verify results (speed limit tag ON)', async () => {
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:49');
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagActivated.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(speedLimitTagOnData);
    });

    await test.step('Remove speed limit tag and verify (OFF)', async () => {
      await headerPage.selectCompositionCode(PLACEHOLDER);
      await timesStopsTablePage.waitForSimulation();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:48');
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagDisabled.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(speedLimitTagOffData);
    });
  });

  /** *************** Test 3 **************** */
  test('Check default linear margin and activate mareco margin', async ({
    browserName,
    headerPage,
    scenarioTimetableSection,
    opSimulationResultPage,
    timesStopsTablePage,
  }) => {
    await test.step('Disable electrical profile and set a 10% theoretical margin on the origin (default STANDARD/linear distribution)', async () => {
      await headerPage.toggleElectricalProfiles(false);
      const westStationRow = timesStopsTablePage.getRow(0);
      await timesStopsTablePage.editRequestedMarginWithUnit(westStationRow, '10', 'percent');
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step('Verify results (Linear)', async () => {
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:51');
      await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-LinearMargin.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(linearMarginData);
    });

    await test.step('Switch to Mareco margin and verify', async () => {
      await headerPage.selectRecoveryMargin('MARECO');
      await timesStopsTablePage.waitForSimulation();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('11:51');
      if (browserName === 'chromium') {
        await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-MarecoMargin.png'
        );
      }
      await timesStopsTablePage.verifyTimesStopsTableContent(marecoMarginData);
    });
  });

  /** *************** Test 4 **************** */
  test(
    'Add all the simulation settings',
    { tag: '@smoke' },
    async ({
      browserName,
      headerPage,
      scenarioTimetableSection,
      opSimulationResultPage,
      timesStopsTablePage,
    }) => {
      await test.step('Set a 5% theoretical margin on the origin', async () => {
        const westStationRow = timesStopsTablePage.getRow(0);
        await timesStopsTablePage.editRequestedMarginWithUnit(westStationRow, '5', 'percent');
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Enable electrical profile + speed limit tag', async () => {
        await headerPage.toggleElectricalProfiles(true);
        await headerPage.selectCompositionCode('E32C');
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Verify outputs (all settings ON)', async () => {
        await opSimulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        if (browserName === 'chromium') {
          await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
            'SpeedSpaceChart-AllSettingsEnabled.png'
          );
        }
        await timesStopsTablePage.verifyTimesStopsTableContent(allSettingsData);
        await scenarioTimetableSection.getTrainScheduleArrivalTime('11:50');
      });
    }
  );
});
