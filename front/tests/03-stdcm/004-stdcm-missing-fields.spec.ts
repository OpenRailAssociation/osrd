import type { Infra } from 'common/api/osrdEditoastApi';

import {
  ALL_MISSING_FIELDS_KEY,
  getFieldsLabel,
  PARTIAL_MISSING_FIELDS_KEYS,
  REMOVED_MISSING_FIELDS_KEYS,
} from '../assets/constants/stdcm/missing-fields';
import { electricRollingStockName } from './../assets/constants/project-const';
import test from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import {
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  INVALID_CONSIST_DATA,
  LIGHT_ORIGIN_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VALID_CONSIST_DATA,
} from '../assets/constants/stdcm/stdcm-const';

test.describe('@stdcm @stdcm-missing-fields', () => {
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify missing fields warnings when launching simulation', async ({
    stdcmPage,
    consistSection,
    originSection,
    destinationSection,
    stdcmSimulationResultPage,
  }) => {
    await test.step('Launch simulation with all fields empty → expect all missing field warnings', async () => {
      const allMissingLabels = getFieldsLabel(ALL_MISSING_FIELDS_KEY, STDCM_TRANSLATIONS);
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains(allMissingLabels);
    });

    await test.step('Fill origin and destination → expect partial missing field warnings', async () => {
      await originSection.fillOriginDetailsLight({
        originDetails: {
          ...LIGHT_ORIGIN_DETAILS,
          suggestionText: CI_SUGGESTIONS.north[2],
        },
        expectedSuggestions: CI_SUGGESTIONS.north,
        expectedCiValue: CI_SUGGESTIONS.north[2],
      });
      await destinationSection.fillDestinationDetailsLight();
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();

      const partialMissingLabels = getFieldsLabel(PARTIAL_MISSING_FIELDS_KEYS, STDCM_TRANSLATIONS);
      const nonMissingLabels = getFieldsLabel(REMOVED_MISSING_FIELDS_KEYS, STDCM_TRANSLATIONS);
      await stdcmPage.expectWarningBoxContains(partialMissingLabels, nonMissingLabels);
    });

    await test.step('Fill all mandatory fields → expect valid simulation', async () => {
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: { tractionEngine: electricRollingStockName },
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
          expectedLength: TRACTION_ENGINE_PREFILLED_VALUES.length,
        },
      });
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmPage.expectWarningBoxHidden();
      await stdcmSimulationResultPage.verifySimulationDetails(SIMULATION_RESULTS_DETAILS);
    });

    await test.step('Enter invalid tonnage, length and max speed → expect invalid field warnings', async () => {
      await consistSection.setTonnage(INVALID_CONSIST_DATA.invalidTonnage);
      await consistSection.setLength(INVALID_CONSIST_DATA.invalidLength);
      await consistSection.setMaxSpeed(INVALID_CONSIST_DATA.invalidMaxSpeed);
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains([
        STDCM_TRANSLATIONS.stdcmErrors.invalidFields.totalMass,
        STDCM_TRANSLATIONS.stdcmErrors.invalidFields.totalLength,
        STDCM_TRANSLATIONS.stdcmErrors.invalidFields.maxSpeed,
      ]);
    });

    await test.step('Fix tonnage, clear length and destination → expect missing + invalid warnings', async () => {
      await consistSection.setTonnage(VALID_CONSIST_DATA.validTonnage);
      await consistSection.clearLength();
      await destinationSection.clearDestination();
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains([
        STDCM_TRANSLATIONS.stdcmErrors.missingFields.destination,
        STDCM_TRANSLATIONS.stdcmErrors.missingFields.totalLength,
        STDCM_TRANSLATIONS.stdcmErrors.invalidFields.maxSpeed,
      ]);
    });

    await test.step('Fill all fields with valid values → expect valid simulation', async () => {
      await consistSection.setLength(VALID_CONSIST_DATA.validLength);
      await consistSection.setMaxSpeed(VALID_CONSIST_DATA.validMaxSpeed);
      await destinationSection.fillDestinationDetailsLight();

      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmPage.expectWarningBoxHidden();
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 1,
        simulationLengthAndDuration: '51 km — 22min',
        validSimulationNumber: 2,
      });
    });
  });
});
