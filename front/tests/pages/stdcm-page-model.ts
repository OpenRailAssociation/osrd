import fs from 'fs';
import path from 'path';

import { expect, type Locator, type Page } from '@playwright/test';

import enTranslations from '../../public/locales/en/stdcm.json';
import frTranslations from '../../public/locales/fr/stdcm.json';
import {
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  DESTINATION_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
  VIA_STOP_TIMES,
  VIA_STOP_TYPES,
} from '../assets/stdcm-const';
import { logger } from '../test-logger';
import { handleAndVerifyInput, readJsonFile } from '../utils';

interface TableRow {
  index: number;
  operationalPoint: string;
  code: string;
  endStop: string | null;
  passageStop: string | null;
  startStop: string | null;
  weight: string | null;
  refEngine: string | null;
}

export interface ConsistFields {
  tractionEngine: string;
  towedRollingStock?: string;
  tonnage?: string;
  length?: string;
  maxSpeed?: string;
  speedLimitTag?: string;
}

const MINIMUM_SIMULATION_NUMBER = 1;

class STDCMPage {
  readonly page: Page;

  readonly debugButton: Locator;

  readonly notificationHeader: Locator;

  readonly consistCard: Locator;

  readonly originCard: Locator;

  readonly destinationCard: Locator;

  readonly mapContainer: Locator;

  readonly tractionEngineField: Locator;

  readonly towedRollingStockField: Locator;

  readonly tonnageField: Locator;

  readonly lengthField: Locator;

  readonly speedLimitTagField: Locator;

  readonly maxSpeedField: Locator;

  readonly addViaButton: Locator;

  readonly anteriorLinkedTrainContainer: Locator;

  readonly anteriorAddLinkedPathButton: Locator;

  readonly posteriorLinkedTrainContainer: Locator;

  readonly posteriorAddLinkedPathButton: Locator;

  readonly launchSimulationButton: Locator;

  readonly originChField: Locator;

  readonly destinationChField: Locator;

  readonly originCiField: Locator;

  readonly destinationCiField: Locator;

  readonly viaIcon: Locator;

  readonly viaDeleteButton: Locator;

  readonly originArrival: Locator;

  readonly dateOriginArrival: Locator;

  readonly timeOriginArrival: Locator;

  readonly toleranceOriginArrival: Locator;

  readonly destinationArrival: Locator;

  readonly dateDestinationArrival: Locator;

  readonly timeDestinationArrival: Locator;

  readonly closeTimePickerButton: Locator;

  readonly toleranceDestinationArrival: Locator;

  readonly closeTolerancePickerButton: Locator;

  readonly warningBox: Locator;

  readonly suggestionList: Locator;

  readonly suggestionNS: Locator;

  readonly suggestionNWS: Locator;

  readonly suggestionSS: Locator;

  readonly suggestionMES: Locator;

  readonly suggestionMWS: Locator;

  readonly dynamicOriginCh: Locator;

  readonly dynamicDestinationCh: Locator;

  readonly dynamicOriginCi: Locator;

  readonly dynamicDestinationCi: Locator;

  readonly suggestionItems: Locator;

  readonly simulationStatus: Locator;

  readonly simulationList: Locator;

  readonly incrementButton: Locator;

  readonly allViasButton: Locator;

  readonly retainSimulationButton: Locator;

  readonly downloadSimulationButton: Locator;

  readonly downloadLink: Locator;

  readonly startNewQueryButton: Locator;

  readonly startNewQueryWithDataButton: Locator;

  readonly originMarker: Locator;

  readonly destinationMarker: Locator;

  readonly viaMarker: Locator;

  readonly mapResultContainer: Locator;

  readonly originResultMarker: Locator;

  readonly destinationResultMarker: Locator;

  readonly viaResultMarker: Locator;

  readonly simulationResultTable: Locator;

  readonly simulationLengthAndDuration: Locator;

  readonly helpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.notificationHeader = page.locator('#notification');
    this.debugButton = page.getByTestId('stdcm-debug-button');
    this.helpButton = page.getByTestId('stdcm-help-button');
    this.mapContainer = page.locator('#stdcm-map-config');
    this.consistCard = page.locator('.stdcm-consist-container .stdcm-card');
    this.originCard = page.locator('.stdcm-card:has(.stdcm-origin-icon)');
    this.destinationCard = page.locator('.stdcm-card:has(.stdcm-destination-icon)');
    this.tractionEngineField = page.locator('#tractionEngine');
    this.towedRollingStockField = page.locator('#towedRollingStock');
    this.tonnageField = page.locator('#tonnage');
    this.lengthField = page.locator('#length');
    this.speedLimitTagField = page.locator('#speed-limit-by-tag-selector');
    this.maxSpeedField = page.locator('#maxSpeed');
    this.addViaButton = page.locator('.stdcm-vias-list button .stdcm-card__body.add-via');
    this.anteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.anterior-linked-train'
    );
    this.anteriorAddLinkedPathButton =
      this.anteriorLinkedTrainContainer.locator('.add-linked-train');
    this.posteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.posterior-linked-train'
    );
    this.posteriorAddLinkedPathButton =
      this.posteriorLinkedTrainContainer.locator('.add-linked-train');
    this.launchSimulationButton = page.getByTestId('launch-simulation-button');
    this.originChField = this.originCard.locator('[data-testid="operational-point-ch"]');
    this.destinationChField = this.destinationCard.locator('[data-testid="operational-point-ch"]');
    this.originCiField = this.originCard.locator('[data-testid="operational-point-ci"]');
    this.destinationCiField = this.destinationCard.locator('[data-testid="operational-point-ci"]');
    this.viaIcon = page.locator('.stdcm-via-icons');
    this.viaDeleteButton = page.getByTestId('delete-via-button');
    this.originArrival = page.locator('#select-origin-arrival');
    this.dateOriginArrival = page.locator('#date-origin-arrival');
    this.timeOriginArrival = page.locator('#time-origin-arrival');
    this.toleranceOriginArrival = page.locator('#stdcm-tolerance-origin-arrival');
    this.destinationArrival = page.locator('#select-destination-arrival');
    this.dateDestinationArrival = page.locator('#date-destination-arrival');
    this.timeDestinationArrival = page.locator('#time-destination-arrival');
    this.closeTimePickerButton = page.locator('.time-picker .close-button');
    this.toleranceDestinationArrival = page.locator('#stdcm-tolerance-destination-arrival');
    this.closeTolerancePickerButton = page.locator('.tolerance-picker .close-button');
    this.warningBox = page.getByTestId('warning-box');
    this.suggestionList = page.locator('.suggestions-list');
    this.suggestionItems = this.suggestionList.locator('.suggestion-item');
    this.suggestionNS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'NS North_station',
    });
    this.suggestionNWS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'NWS North_West_station',
    });

    this.suggestionSS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'SS South_station',
    });

    this.suggestionMES = this.suggestionList.locator('.suggestion-item', {
      hasText: 'MES Mid_East_station',
    });
    this.suggestionMWS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'MWS Mid_West_station',
    });

    this.dynamicOriginCh = this.originCard.locator('[data-testid="operational-point-ch"]');
    this.dynamicDestinationCh = this.destinationCard.locator(
      '[data-testid="operational-point-ch"]'
    );
    this.dynamicOriginCi = this.originCard.locator('[data-testid="operational-point-ci"]');
    this.dynamicDestinationCi = this.destinationCard.locator(
      '[data-testid="operational-point-ci"]'
    );
    this.simulationStatus = page.getByTestId('simulation-status');
    this.simulationList = page.locator('.stdcm-results .simulation-list');
    this.incrementButton = page.locator('.minute-button', { hasText: '+1mn' });
    this.allViasButton = page.getByTestId('all-vias-button');
    this.retainSimulationButton = page.getByTestId('retain-simulation-button');
    this.downloadSimulationButton = page.locator('.download-simulation a[download]');
    this.downloadLink = page.locator('.download-simulation a');
    this.startNewQueryButton = page.getByTestId('start-new-query-button');
    this.startNewQueryWithDataButton = page.getByTestId('start-new-query-with-data-button');
    this.originMarker = this.mapContainer.locator('img[alt="origin"]');
    this.destinationMarker = this.mapContainer.locator('img[alt="destination"]');
    this.viaMarker = this.mapContainer.locator('img[alt="via"]');
    this.mapResultContainer = page.locator('#stdcm-map-result');
    this.originResultMarker = this.mapResultContainer.locator('img[alt="origin"]');
    this.destinationResultMarker = this.mapResultContainer.locator('img[alt="destination"]');
    this.viaResultMarker = this.mapResultContainer.locator('img[alt="via"]');
    this.simulationResultTable = page.locator('.simulation-results table.table-results');
    this.simulationLengthAndDuration = page.locator(
      '.simulation-metadata .total-length-trip-duration'
    );
  }

  // Dynamic selectors for via cards
  private getViaCard(viaNumber: number): Locator {
    return this.page.locator(`.stdcm-card:has(.stdcm-via-icons:has-text("${viaNumber}"))`);
  }

  private getViaCH(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('[data-testid="operational-point-ch"]');
  }

  private getViaCI(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('[data-testid="operational-point-ci"]');
  }

  private getViaType(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('#type');
  }

  private getViaStopTime(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('#stdcm-via-stop-time');
  }

  private getViaWarning(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).locator('.status-message');
  }

  private async setMinuteLocator(minuteValue: string) {
    const minuteLocator = this.page.locator('.time-grid .minute', { hasText: minuteValue });
    await minuteLocator.click();
  }

  private async setHourLocator(hourValue: string) {
    const hourLocator = this.page.locator('.time-grid .hour', { hasText: hourValue });
    await hourLocator.click();
  }

  private getSimulationLengthAndDurationLocator(simulationNumber: number): Locator {
    return this.simulationList
      .locator('.simulation-metadata .total-length-trip-duration')
      .nth(simulationNumber - 1);
  }

  private getSimulationNameLocator(simulationNumber: number): Locator {
    return this.simulationList.locator('.simulation-name').nth(simulationNumber - 1);
  }

  private async verifySuggestions(expectedSuggestions: string[]) {
    await expect(this.suggestionList).toBeVisible();
    expect(await this.suggestionItems.count()).toBe(expectedSuggestions.length);
    const actualSuggestions = await this.suggestionItems.allTextContents();
    expect(actualSuggestions).toEqual(expectedSuggestions);
  }

  // Verify STDCM elements are visible
  async verifyStdcmElementsVisibility() {
    const elements = [
      this.debugButton,
      this.helpButton,
      this.notificationHeader,
      this.consistCard,
      this.originCard,
      this.addViaButton,
      this.anteriorAddLinkedPathButton,
      this.posteriorAddLinkedPathButton,
      this.destinationCard,
      this.mapContainer,
      this.launchSimulationButton,
    ];
    for (const element of elements) {
      await expect(element).toBeVisible();
    }
  }

  // Verify all input fields are empty
  async verifyAllDefaultPageFields() {
    const emptyFields = [
      this.tractionEngineField,
      this.towedRollingStockField,
      this.tonnageField,
      this.lengthField,
      this.maxSpeedField,
      this.originCiField,
      this.destinationCiField,
      this.originChField,
      this.destinationChField,
    ];
    const { arrivalDate, arrivalTime, tolerance, speedLimitTag } = DEFAULT_DETAILS;
    for (const field of emptyFields) await expect(field).toHaveValue('');
    await expect(this.originArrival).toHaveValue(ORIGIN_DETAILS.arrivalType.default);
    await expect(this.destinationArrival).toHaveValue(DESTINATION_DETAILS.arrivalType.default);
    await expect(this.speedLimitTagField).toHaveValue(speedLimitTag);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
  }

  // Add a via card, verify fields, and delete it
  async addAndDeletedDefaultVia() {
    await this.addViaButton.click();
    await expect(this.getViaCI(1)).toHaveValue('');
    await expect(this.getViaCH(1)).toHaveValue('');
    await expect(this.getViaType(1)).toHaveValue(VIA_STOP_TYPES.PASSAGE_TIME);
    await this.viaIcon.hover();
    await expect(this.viaDeleteButton).toBeVisible();
    await this.viaDeleteButton.click();
    await expect(this.getViaCI(1)).not.toBeVisible();
    await expect(this.getViaCH(1)).not.toBeVisible();
    await expect(this.getViaType(1)).not.toBeVisible();
  }

  // Verify the origin suggestions when searching for north
  async verifyOriginNorthSuggestions() {
    await this.verifySuggestions(CI_SUGGESTIONS.north);
  }

  // Verify the destination suggestions when searching for south
  async verifyDestinationSouthSuggestions() {
    await this.verifySuggestions(CI_SUGGESTIONS.south);
  }

  // Fill fields with test values in the consist section
  async fillAndVerifyConsistDetails(
    consistFields: ConsistFields,
    tractionEngineTonnage: string,
    tractionEngineLength: string,
    tractionEngineMaxSpeed: string,
    towedRollingStockTonnage?: string,
    towedRollingStockLength?: string,
    towedRollingStockMaxSpeed?: string
  ): Promise<void> {
    const { tractionEngine, towedRollingStock, tonnage, length, maxSpeed, speedLimitTag } =
      consistFields;

    // Generic utility for handling dropdown selection and value verification
    const handleAndVerifyDropdown = async (
      dropdownField: Locator,
      expectedValues: { expectedTonnage: string; expectedLength: string; expectedMaxSpeed: string },
      selectedValue?: string
    ) => {
      if (!selectedValue) return;

      await dropdownField.fill(selectedValue);
      await dropdownField.press('ArrowDown');
      await dropdownField.press('Enter');
      await dropdownField.dispatchEvent('blur');
      await expect(dropdownField).toHaveValue(selectedValue);

      const { expectedTonnage, expectedLength, expectedMaxSpeed } = expectedValues;
      await expect(this.tonnageField).toHaveValue(expectedTonnage);
      await expect(this.lengthField).toHaveValue(expectedLength);
      await expect(this.maxSpeedField).toHaveValue(expectedMaxSpeed);
    };

    // Utility to calculate prefilled values for towed rolling stock
    const calculateTowedPrefilledValues = () => {
      if (!towedRollingStockTonnage || !towedRollingStockLength || !towedRollingStockMaxSpeed) {
        return { expectedTonnage: '0', expectedLength: '0', expectedMaxSpeed: '0' };
      }

      return {
        expectedTonnage: (
          parseFloat(towedRollingStockTonnage) + parseFloat(tractionEngineTonnage)
        ).toString(),
        expectedLength: (
          parseFloat(towedRollingStockLength) + parseFloat(tractionEngineLength)
        ).toString(),
        expectedMaxSpeed: Math.min(
          parseFloat(towedRollingStockMaxSpeed),
          parseFloat(tractionEngineMaxSpeed)
        ).toString(),
      };
    };

    // Calculate prefilled values for the towed rolling stock
    const towedPrefilledValues = calculateTowedPrefilledValues();

    // Fill and verify traction engine dropdown
    await handleAndVerifyDropdown(
      this.tractionEngineField,
      {
        expectedTonnage: tractionEngineTonnage,
        expectedLength: tractionEngineLength,
        expectedMaxSpeed: tractionEngineMaxSpeed,
      },
      tractionEngine
    );

    // Fill and verify towed rolling stock dropdown
    await handleAndVerifyDropdown(
      this.towedRollingStockField,
      towedPrefilledValues,
      towedRollingStock
    );

    // Fill and verify individual fields
    await handleAndVerifyInput(this.tonnageField, tonnage);
    await handleAndVerifyInput(this.lengthField, length);
    await handleAndVerifyInput(this.maxSpeedField, maxSpeed);

    // Handle optional speed limit tag
    if (speedLimitTag) {
      await this.speedLimitTagField.selectOption(speedLimitTag);
      await expect(this.speedLimitTagField).toHaveValue(speedLimitTag);
    }
  }

  // Fill and verify origin details with suggestions
  async fillAndVerifyOriginDetails() {
    const {
      input,
      suggestion,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      updatedChValue,
      arrivalType,
    } = ORIGIN_DETAILS;
    // Fill and verify origin CI suggestions
    await this.dynamicOriginCi.fill(input);
    await this.verifyOriginNorthSuggestions();
    await this.suggestionNWS.click();
    const originCiValue = await this.dynamicOriginCi.getAttribute('value');
    expect(originCiValue).toContain(suggestion);
    // Verify default values
    await expect(this.dynamicOriginCh).toHaveValue(chValue);
    await expect(this.originArrival).toHaveValue(arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
    // Update and verify origin values
    await this.dynamicOriginCh.selectOption(updatedChValue);
    await expect(this.dynamicOriginCh).toHaveValue(updatedChValue);
    await this.originArrival.selectOption(arrivalType.updated);
    await expect(this.originArrival).toHaveValue(arrivalType.updated);
    // Verify fields are hidden
    await expect(this.dateOriginArrival).not.toBeVisible();
    await expect(this.timeOriginArrival).not.toBeVisible();
    await expect(this.toleranceOriginArrival).not.toBeVisible();
  }

  // Fill and verify destination details based on selected language
  async fillAndVerifyDestinationDetails(selectedLanguage: string) {
    const {
      input,
      suggestion,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      arrivalType,
      updatedDetails,
    } = DESTINATION_DETAILS;
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    // Fill destination input and verify suggestions
    await this.dynamicDestinationCi.fill(input);
    await this.verifyDestinationSouthSuggestions();
    await this.suggestionSS.click();
    const destinationCiValue = await this.dynamicDestinationCi.getAttribute('value');
    expect(destinationCiValue).toContain(suggestion);
    // Verify default values
    await expect(this.dynamicDestinationCh).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType.default);
    await expect(this.warningBox).toContainText(translations.stdcmErrors.noScheduledPoint);
    await expect(this.dateDestinationArrival).not.toBeVisible();
    await expect(this.timeDestinationArrival).not.toBeVisible();
    await expect(this.toleranceDestinationArrival).not.toBeVisible();
    // Select 'preciseTime' and verify values
    await this.destinationArrival.selectOption(arrivalType.updated);
    await expect(this.destinationArrival).toHaveValue(arrivalType.updated);
    await expect(this.dateDestinationArrival).toHaveValue(arrivalDate);
    await expect(this.timeDestinationArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceDestinationArrival).toHaveValue(tolerance);
    // Update date and time values
    await this.dateDestinationArrival.fill(updatedDetails.date);
    await expect(this.dateDestinationArrival).toHaveValue(updatedDetails.date);
    await this.timeDestinationArrival.click();
    await this.setHourLocator(updatedDetails.hour);
    await this.setMinuteLocator(updatedDetails.minute);
    await this.incrementButton.dblclick(); // Double-click the +1 minute button to reach 37
    await this.closeTimePickerButton.click();
    await expect(this.timeDestinationArrival).toHaveValue(updatedDetails.timeValue);

    // Update tolerance and verify warning box
    await this.fillToleranceField(
      updatedDetails.tolerance.negative,
      updatedDetails.tolerance.positive,
      false
    );
    await expect(this.warningBox).not.toBeVisible();
  }

  // Fill origin section
  async fillOriginDetailsLight(arrivalTypeOverride: string = '', isPrecise: boolean = false) {
    const { input, chValue, arrivalDate, arrivalTime, tolerance, arrivalType } =
      LIGHT_ORIGIN_DETAILS;
    await this.dynamicOriginCi.fill(input);
    await this.suggestionNWS.click();
    if (isPrecise && arrivalTypeOverride) {
      await this.originArrival.selectOption(arrivalTypeOverride);
    } else {
      await expect(this.dynamicOriginCh).toHaveValue(chValue);
      await expect(this.originArrival).toHaveValue(arrivalType);
      await this.dateOriginArrival.fill(arrivalDate);
      await this.timeOriginArrival.fill(arrivalTime);
      await this.fillToleranceField(tolerance.negative, tolerance.positive, true);
    }
  }

  // Fill destination section
  async fillDestinationDetailsLight() {
    const { input, chValue, arrivalType } = LIGHT_DESTINATION_DETAILS;
    await this.dynamicDestinationCi.fill(input);
    await this.suggestionSS.click();
    await expect(this.dynamicDestinationCh).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType);
  }

  async fillToleranceField(minusValue: string, plusValue: string, isOrigin: boolean) {
    const toleranceField = isOrigin
      ? this.toleranceOriginArrival
      : this.toleranceDestinationArrival;

    await toleranceField.click();
    await this.page.getByRole('button', { name: minusValue, exact: true }).click();
    await this.page.getByRole('button', { name: plusValue, exact: true }).click();
    await expect(toleranceField).toHaveValue(`${minusValue}/${plusValue}`);
    await this.closeTolerancePickerButton.click();
  }

  async fillAndVerifyViaDetails({
    viaNumber,
    ciSearchText,
    language,
  }: {
    viaNumber: number;
    ciSearchText: string;
    language?: string;
  }): Promise<void> {
    const { PASSAGE_TIME, SERVICE_STOP, DRIVER_SWITCH } = VIA_STOP_TYPES;
    const { serviceStop, driverSwitch } = VIA_STOP_TIMES;
    const translations = language === 'English' ? enTranslations : frTranslations;
    const warning = this.getViaWarning(viaNumber);
    // Helper function to fill common fields
    const fillVia = async (selectedSuggestion: Locator) => {
      await this.addViaButton.nth(viaNumber - 1).click();
      expect(await this.addViaButton.count()).toBe(viaNumber + 1);
      await expect(this.getViaCI(viaNumber)).toBeVisible();
      await this.getViaCI(viaNumber).fill(ciSearchText);
      await selectedSuggestion.click();
      await expect(this.getViaCH(viaNumber)).toHaveValue(DEFAULT_DETAILS.chValue);
      await expect(this.getViaType(viaNumber)).toHaveValue(PASSAGE_TIME);
    };

    switch (ciSearchText) {
      case 'mid_west':
        await fillVia(this.suggestionMWS);
        break;

      case 'mid_east':
        await fillVia(this.suggestionMES);
        await this.getViaType(viaNumber).selectOption(SERVICE_STOP);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(serviceStop.default);
        await this.getViaStopTime(viaNumber).fill(serviceStop.input);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(serviceStop.input);
        break;

      case 'nS':
        await fillVia(this.suggestionNS);
        await this.getViaType(viaNumber).selectOption(DRIVER_SWITCH);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.default);
        await this.getViaStopTime(viaNumber).fill(driverSwitch.invalidInput);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.invalidInput);
        await expect(warning).toBeVisible();
        expect(await warning.textContent()).toEqual(translations.trainPath.warningMinStopTime);
        await this.getViaStopTime(viaNumber).fill(driverSwitch.validInput);
        await expect(this.getViaStopTime(viaNumber)).toHaveValue(driverSwitch.validInput);
        await expect(warning).not.toBeVisible();
        break;

      default:
        throw new Error(`Unsupported viaSearch value: ${ciSearchText}`);
    }
  }

  // Launch the simulation and check if simulation-related elements are visible
  async launchSimulation(): Promise<void> {
    await this.launchSimulationButton.waitFor({ state: 'visible' });
    await expect(this.launchSimulationButton).toBeEnabled();
    await this.launchSimulationButton.click({ force: true });
    // Wait for simulation elements to load and validate their presence
    await this.simulationList.waitFor({ timeout: 60_000 });
    const simulationElements = await this.simulationList.all();

    if (simulationElements.length < MINIMUM_SIMULATION_NUMBER) {
      throw new Error(
        `Expected at least ${MINIMUM_SIMULATION_NUMBER} simulation, but found ${simulationElements.length}.`
      );
    }
    // Check map result container visibility only for Chromium browser
    if (this.page.context().browser()?.browserType().name() === 'chromium') {
      await expect(this.mapResultContainer).toBeVisible();
    }
  }

  async verifyTableData(tableDataPath: string): Promise<void> {
    // Load expected data from JSON file
    const jsonData: TableRow[] = readJsonFile(tableDataPath);
    // Extract rows from the HTML table and map each row's data to match JSON structure
    const tableRows = await this.page.$$eval('.table-results tbody tr', (rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          index: Number(cells[0]?.textContent?.trim()) || 0,
          operationalPoint: cells[1]?.textContent?.trim() || '',
          code: cells[2]?.textContent?.trim() || '',
          endStop: cells[3]?.textContent?.trim() || '',
          passageStop: cells[4]?.textContent?.trim() || '',
          startStop: cells[5]?.textContent?.trim() || '',
          weight: cells[6]?.textContent?.trim() || '',
          refEngine: cells[7]?.textContent?.trim() || '',
        };
      })
    );

    // Compare JSON data and table rows by index for consistency
    jsonData.forEach((jsonRow, index) => {
      const tableRow = tableRows[index];

      // Check if the row exists in the HTML table
      if (!tableRow) {
        logger.error(`Row ${index + 1} is missing in the HTML table`);
        return;
      }
      expect(tableRow.operationalPoint).toBe(jsonRow.operationalPoint);
      expect(tableRow.code).toBe(jsonRow.code);
      expect(tableRow.endStop).toBe(jsonRow.endStop);
      expect(tableRow.passageStop).toBe(jsonRow.passageStop);
      expect(tableRow.startStop).toBe(jsonRow.startStop);
      expect(tableRow.weight).toBe(jsonRow.weight);
      expect(tableRow.refEngine).toBe(jsonRow.refEngine);
    });
  }

  async displayAllOperationalPoints() {
    await this.allViasButton.click();
  }

  async retainSimulation() {
    await this.retainSimulationButton.click();
    await expect(this.downloadSimulationButton).toBeVisible();
    await expect(this.downloadSimulationButton).toBeEnabled();
    await expect(this.startNewQueryButton).toBeVisible();
    await expect(this.startNewQueryWithDataButton).toBeVisible();
  }

  async downloadSimulation(browserName: string, isLinkedTrain: boolean = false): Promise<void> {
    try {
      // Wait until there are no network requests for stability
      await this.page.waitForLoadState('networkidle');

      // Get the download link element and suggested filename
      const suggestedFilename = await this.downloadLink.getAttribute('download');
      expect(suggestedFilename).toMatch(/^Stdcm.*\.pdf$/);

      const downloadDir = isLinkedTrain
        ? path.join('./tests/stdcm-results/linkedTrain', browserName)
        : path.join('./tests/stdcm-results', browserName);
      const downloadPath = path.join(downloadDir, suggestedFilename!);

      await fs.promises.mkdir(downloadDir, { recursive: true });

      // Get the file content from the `blob:` URL
      const fileContent = await this.downloadSimulationButton.evaluate(async (el) => {
        if (!(el instanceof HTMLAnchorElement)) {
          throw new Error('Element is not an anchor tag');
        }

        const response = await fetch(el.href);
        if (!response.ok) {
          throw new Error(`Failed to fetch the blob: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      });

      // Write the file to the local file system
      await fs.promises.writeFile(downloadPath, Buffer.from(fileContent));

      logger.info(`The PDF was successfully downloaded to: ${downloadPath}`);
    } catch (error) {
      logger.error('Failed to download simulation', error);
    }
  }

  async startNewQuery() {
    await this.startNewQueryButton.click();
  }

  async mapMarkerVisibility() {
    await expect(this.originMarker).toBeVisible();
    await expect(this.destinationMarker).toBeVisible();
    await expect(this.viaMarker).toBeVisible();
  }

  async mapMarkerResultVisibility() {
    await expect(this.originResultMarker).toBeVisible();
    await expect(this.destinationResultMarker).toBeVisible();
    await expect(this.viaResultMarker).toBeVisible();
  }

  async verifySimulationDetails({
    language,
    simulationNumber,
    simulationLengthAndDuration,
  }: {
    language: string;
    simulationNumber: number;
    simulationLengthAndDuration?: string | null;
  }): Promise<void> {
    const translations = language === 'English' ? enTranslations : frTranslations;
    const noCapacityLengthAndDuration = '— ';
    // Determine expected simulation name
    const isResultTableVisible = await this.simulationResultTable.isVisible();
    const expectedSimulationName = isResultTableVisible
      ? `Simulation n°${simulationNumber}`
      : translations.simulation.results.simulationName.withoutOutputs;

    // Validate simulation name
    const actualSimulationName =
      await this.getSimulationNameLocator(simulationNumber).textContent();
    expect(actualSimulationName).toEqual(expectedSimulationName);

    // Determine expected length and duration
    const expectedLengthAndDuration = isResultTableVisible
      ? simulationLengthAndDuration
      : noCapacityLengthAndDuration;
    const actualLengthAndDuration =
      await this.getSimulationLengthAndDurationLocator(simulationNumber).textContent();

    // Validate length and duration
    expect(actualLengthAndDuration).toEqual(expectedLengthAndDuration);
  }
}
export default STDCMPage;
