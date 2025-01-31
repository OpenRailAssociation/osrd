import type { Infra } from 'common/api/osrdEditoastApi';

import {
  allMissingFieldsKeys,
  getFieldsLabel,
  partialMissingFieldsKeys,
} from './assets/constants/missing-fields';
import { electricRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import type { StdcmTranslations } from './utils/types';

const enTranslations: StdcmTranslations = readJsonFile('public/locales/en/stdcm.json');
const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

test.describe('Verify stdcm missing fields', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;
  let translations: StdcmTranslations;
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
    translations = getTranslations({ en: enTranslations, fr: frTranslations });

    await page.goto('/stdcm');
    await page.waitForLoadState('networkidle');
    await stdcmPage.removeViteOverlay();

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify missing fields warnings when launching simulation', async () => {
    // Step 1 — verify all missing fields
    const allMissingLabels = getFieldsLabel(allMissingFieldsKeys, translations);
    await stdcmPage.launchSimulationWithEmptyFields();
    await stdcmPage.expectWarningBoxVisible();
    await stdcmPage.expectWarningBoxContains(allMissingLabels);

    // Step 2 — fill origin & destination and relaunch
    await originSection.fillOriginDetailsLight();
    await destinationSection.fillDestinationDetailsLight();
    await stdcmPage.launchSimulationWithEmptyFields();
    await stdcmPage.expectWarningBoxVisible();

    const partialMissingLabels = getFieldsLabel(partialMissingFieldsKeys, translations);
    const nonMissingLabels = getFieldsLabel(['origin', 'destination'], translations);
    await stdcmPage.expectWarningBoxContains(partialMissingLabels, nonMissingLabels);
  });

  /** *************** Test 2 **************** */
  test('Launch simulation with all mandatory fields filled', async () => {
    await originSection.fillOriginDetailsLight();
    await destinationSection.fillDestinationDetailsLight();
    await consistSection.fillAndVerifyConsistDetails(
      { tractionEngine: electricRollingStockName },
      '900',
      '400'
    );

    await stdcmPage.expectWarningBoxHidden();
    await stdcmPage.launchSimulation();
    await simulationResultPage.verifySimulationDetails({
      simulationIndex: 0,
      simulationLengthAndDuration: '51 km — 48min',
      validSimulationNumber: 1,
    });
  });

  // TODO: Add more tests to cover invalid fields
});
