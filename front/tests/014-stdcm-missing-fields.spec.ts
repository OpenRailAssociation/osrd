import type { Infra } from 'common/api/osrdEditoastApi';

import {
  ALL_MISSING_FIELDS_KEY,
  getFieldsLabel,
  PARTIAL_MISSING_FIELDS_KEYS,
  REMOVED_MISSING_FIELDS_KEYS,
} from './assets/constants/missing-fields';
import { electricRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import type { StdcmTranslations } from './utils/types';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

test.describe('Verify stdcm missing fields', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    [stdcmPage, consistSection, originSection, destinationSection, simulationResultPage] = [
      new STDCMPage(page),
      new ConsistSection(page),
      new OriginSection(page),
      new DestinationSection(page),
      new SimulationResultPage(page),
    ];

    await page.goto('/stdcm');
    await stdcmPage.removeViteOverlay();

    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify missing fields warnings when launching simulation', async () => {
    await test.step('Launch simulation with all fields empty → expect all missing field warnings', async () => {
      const allMissingLabels = getFieldsLabel(ALL_MISSING_FIELDS_KEY, frTranslations);
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains(allMissingLabels);
    });

    await test.step('Fill origin and destination → expect partial missing field warnings', async () => {
      await originSection.fillOriginDetailsLight();
      await destinationSection.fillDestinationDetailsLight();
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      const partialMissingLabels = getFieldsLabel(PARTIAL_MISSING_FIELDS_KEYS, frTranslations);
      const nonMissingLabels = getFieldsLabel(REMOVED_MISSING_FIELDS_KEYS, frTranslations);
      await stdcmPage.expectWarningBoxContains(partialMissingLabels, nonMissingLabels);
    });

    await test.step('Fill all mandatory fields → expect valid simulation', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        { tractionEngine: electricRollingStockName },
        '900',
        '400'
      );
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmPage.expectWarningBoxHidden();
      await simulationResultPage.verifySimulationDetails({
        simulationIndex: 0,
        simulationLengthAndDuration: '51 km — 33min',
        validSimulationNumber: 1,
      });
    });

    await test.step('Enter invalid tonnage, length and max speed → expect invalid field warnings', async () => {
      await consistSection.setTonnage('30');
      await consistSection.setLength('12');
      await consistSection.setMaxSpeed('7');
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains([
        frTranslations.stdcmErrors.invalidFields.totalMass,
        frTranslations.stdcmErrors.invalidFields.totalLength,
        frTranslations.stdcmErrors.invalidFields.maxSpeed,
      ]);
    });

    await test.step('Fix tonnage, clear length and destination → expect missing + invalid warnings', async () => {
      await consistSection.setTonnage('900');
      await consistSection.clearLength();
      await destinationSection.clearDestination();
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains([
        frTranslations.stdcmErrors.missingFields.destination,
        frTranslations.stdcmErrors.missingFields.totalLength,
        frTranslations.stdcmErrors.invalidFields.maxSpeed,
      ]);
    });

    await test.step('Fill all fields with valid values → expect valid simulation', async () => {
      await consistSection.setLength('400');
      await consistSection.setMaxSpeed('160');
      await destinationSection.fillDestinationDetailsLight();

      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmPage.expectWarningBoxHidden();
      await simulationResultPage.verifySimulationDetails({
        simulationIndex: 1,
        simulationLengthAndDuration: '51 km — 22min',
        validSimulationNumber: 2,
      });
    });
  });
});
