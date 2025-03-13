import fs from 'fs';
import path from 'path';

import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import { logger } from '../../logging-fixture';
import { getTranslations } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type { STDCMResultTableRow, StdcmTranslations } from '../../utils/types';

const enTranslations: StdcmTranslations = readJsonFile('public/locales/en/stdcm.json');
const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class SimulationResultPage extends STDCMPage {
  private readonly mapResultContainer: Locator;

  private readonly originResultMarker: Locator;

  private readonly destinationResultMarker: Locator;

  private readonly viaResultMarker: Locator;

  private readonly simulationList: Locator;

  private readonly simulationResultTable: Locator;

  private readonly simulationTableRows: Locator;

  private readonly allViasButton: Locator;

  private readonly retainSimulationButton: Locator;

  private readonly downloadSimulationButton: Locator;

  private readonly downloadLink: Locator;

  private readonly startNewQueryButton: Locator;

  private readonly startNewQueryWithDataButton: Locator;

  private readonly feedbackCardContainer: Locator;

  private readonly feedbackTitle: Locator;

  private readonly feedbackDescription: Locator;

  private readonly feedbackButton: Locator;

  constructor(page: Page) {
    super(page);
    this.mapResultContainer = page.locator('#stdcm-map-result');
    this.originResultMarker = this.mapResultContainer.locator('img[alt="origin"]');
    this.destinationResultMarker = this.mapResultContainer.locator('img[alt="destination"]');
    this.viaResultMarker = this.mapResultContainer.locator('img[alt="via"]');
    this.simulationResultTable = page.locator('.simulation-results table.table-results');
    this.simulationTableRows = page.locator('.table-results tbody tr');
    this.allViasButton = page.getByTestId('all-vias-button');
    this.retainSimulationButton = page.getByTestId('retain-simulation-button');
    this.downloadSimulationButton = page.locator('.download-simulation a[download]');
    this.downloadSimulationButton = page.locator('.download-simulation a[download]');
    this.downloadLink = page.locator('.download-simulation a');
    this.startNewQueryButton = page.getByTestId('start-new-query-button');
    this.startNewQueryWithDataButton = page.getByTestId('start-new-query-with-data-button');
    this.simulationList = page.locator('.stdcm-results .simulation-list');
    this.feedbackCardContainer = page.getByTestId('feedback-card');
    this.feedbackTitle = page.getByTestId('feedback-title');
    this.feedbackDescription = page.getByTestId('feedback-card-text');
    this.feedbackButton = page.getByTestId('feedback-button');
  }

  private getSimulationLengthAndDurationLocator(simulationIndex: number): Locator {
    return this.simulationList
      .locator('.simulation-metadata .total-length-trip-duration')
      .nth(simulationIndex);
  }

  private getSimulationNameLocator(simulationIndex: number): Locator {
    return this.simulationList.locator('.simulation-name').nth(simulationIndex);
  }

  async verifyTableData(tableDataPath: string): Promise<void> {
    // Load expected data from JSON file
    const jsonData: STDCMResultTableRow[] = readJsonFile(tableDataPath);
    // Extract rows from the HTML table and map each row's data to match JSON structure
    await this.simulationTableRows.first().waitFor();
    const tableRows = await this.simulationTableRows.evaluateAll((rows) =>
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

  async downloadSimulation(downloadDir: string): Promise<void> {
    // Wait until there are no network requests for stability
    await this.page.waitForLoadState('networkidle');

    // Get the download link element and suggested filename
    const suggestedFilename = await this.downloadLink.getAttribute('download');
    expect(suggestedFilename).toMatch(/^Stdcm.*\.pdf$/);

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
  }

  async startNewQuery() {
    await this.startNewQueryButton.click();
  }

  async mapMarkerResultVisibility() {
    await expect(this.originResultMarker).toBeVisible();
    await expect(this.destinationResultMarker).toBeVisible();
    await expect(this.viaResultMarker).toBeVisible();
  }

  async verifySimulationDetails({
    simulationIndex,
    simulationLengthAndDuration,
    validSimulationNumber,
  }: {
    simulationIndex: number;
    simulationLengthAndDuration?: string | null;
    validSimulationNumber?: number;
  }): Promise<void> {
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    const noCapacityLengthAndDuration = '— ';
    // Determine expected simulation name
    const isResultTableVisible = await this.simulationResultTable.isVisible();
    const expectedSimulationName = isResultTableVisible
      ? `Simulation n°${validSimulationNumber}`
      : translations.simulation.results.simulationName.withoutOutputs;

    // Validate simulation name
    const actualSimulationName = await this.getSimulationNameLocator(simulationIndex).textContent();
    expect(actualSimulationName).toEqual(expectedSimulationName);

    // Determine expected length and duration
    const expectedLengthAndDuration = isResultTableVisible
      ? simulationLengthAndDuration
      : noCapacityLengthAndDuration;
    const actualLengthAndDuration =
      await this.getSimulationLengthAndDurationLocator(simulationIndex).textContent();

    // Validate length and duration
    expect(actualLengthAndDuration).toEqual(expectedLengthAndDuration);
  }

  async verifyFeedbackCardVisibility() {
    await expect(this.simulationResultTable).toBeVisible();
    await expect(this.feedbackCardContainer).toBeVisible();
    await expect(this.feedbackTitle).toBeVisible();
    await expect(this.feedbackDescription).toBeVisible();
    await expect(this.feedbackButton).toBeVisible();
  }

  async clickFeedbackButton() {
    await expect(this.feedbackButton).toBeEnabled();
    await this.feedbackButton.click();
  }

  async verifyMailRedirection(
    expectedSubject: string,
    expectedBody: string,
    expectedEmail: string
  ) {
    const mailtoUrl = await this.feedbackButton.getAttribute('data-mailto');

    const decodedUrl = decodeURIComponent(mailtoUrl!);

    expect(decodedUrl).toContain(`${expectedEmail}`);
    expect(decodedUrl).toContain(`${expectedSubject}`);
    expect(decodedUrl).toContain(`${expectedBody}`);
  }
}
export default SimulationResultPage;
