import fs from 'fs';
import path from 'path';

import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import { logger } from '../../logging-fixture';
import readJsonFile from '../../utils/file-utils';
import type { STDCMResultTableRow, StdcmTranslations } from '../../utils/types';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class SimulationResultPage extends STDCMPage {
  private readonly mapResultContainer: Locator;

  private readonly originResultMarker: Locator;

  private readonly destinationResultMarker: Locator;

  private readonly viaResultMarker: Locator;

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

  private readonly simulationItem: Locator;

  constructor(page: Page) {
    super(page);
    this.simulationItem = page.getByTestId('simulation-item-button');
    this.mapResultContainer = page.locator('#stdcm-map-result');
    this.originResultMarker = this.mapResultContainer.locator('img[alt="origin"]');
    this.destinationResultMarker = this.mapResultContainer.locator('img[alt="destination"]');
    this.viaResultMarker = this.mapResultContainer.locator('img[alt="via"]');
    this.simulationResultTable = page.getByTestId('table-results');
    this.simulationTableRows = this.simulationResultTable.locator('tbody tr');
    this.allViasButton = page.getByTestId('all-vias-button');
    this.retainSimulationButton = page.getByTestId('retain-simulation-button');
    this.downloadSimulationButton = page.getByTestId('download-simulation').locator('a[download]');
    this.downloadLink = page.getByTestId('download-simulation').locator('a');
    this.startNewQueryButton = page.getByTestId('start-new-query-button');
    this.startNewQueryWithDataButton = page.getByTestId('start-new-query-with-data-button');
    this.feedbackCardContainer = page.getByTestId('feedback-card');
    this.feedbackTitle = page.getByTestId('feedback-title');
    this.feedbackDescription = page.getByTestId('feedback-card-text');
    this.feedbackButton = page.getByTestId('feedback-button');
  }

  private getSimulationLengthAndDurationLocator(simulationIndex: number): Locator {
    return this.page.getByTestId('total-length-trip-duration').nth(simulationIndex);
  }

  private getSimulationNameLocator(simulationIndex: number): Locator {
    return this.page.getByTestId('simulation-name').nth(simulationIndex);
  }

  async verifyTableData(tableDataPath: string): Promise<void> {
    // Load expected data from JSON file
    const jsonData: STDCMResultTableRow[] = readJsonFile(tableDataPath);
    // Extract rows from the HTML table and map each row's data to match JSON structure
    await expect(this.simulationTableRows.first()).toBeVisible();
    const tableRows = await this.simulationTableRows.evaluateAll((rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          index: Number(cells[0]?.textContent?.trim()) || 0,
          operationalPoint: cells[1]?.textContent?.trim() || '',
          code: cells[2]?.textContent?.trim() || '',
          track: cells[3]?.textContent?.trim() || '',
          endStop: cells[4]?.textContent?.trim() || '',
          passageStop: cells[5]?.textContent?.trim() || '',
          startStop: cells[6]?.textContent?.trim() || '',
          weight: cells[7]?.textContent?.trim() || '',
          refEngine: cells[8]?.textContent?.trim() || '',
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
      expect(tableRow.track).toBe(jsonRow.track);
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
    await expect(this.downloadLink).toBeVisible();

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.downloadLink.click(),
    ]);

    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/^Stdcm.*\.pdf$/);

    await fs.promises.mkdir(downloadDir, { recursive: true });

    const downloadPath = path.join(downloadDir, suggestedFilename);
    await download.saveAs(downloadPath);

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
    const noCapacityLengthAndDuration = '— ';
    await this.simulationItem.nth(simulationIndex).click();
    // Determine expected simulation name
    const isResultTableVisible = await this.simulationResultTable.isVisible();
    const expectedSimulationName = isResultTableVisible
      ? `Simulation n°${validSimulationNumber}`
      : frTranslations.simulation.results.simulationName.withoutOutputs;
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

  async verifyMailRedirection(
    expectedSubject: string,
    expectedBody: string,
    expectedEmail: string
  ) {
    const mailtoUrl = await this.feedbackButton.getAttribute('href');

    const decodedUrl = decodeURIComponent(mailtoUrl!);

    expect(decodedUrl).toContain(`${expectedEmail}`);
    expect(decodedUrl).toContain(`${expectedSubject}`);
    expect(decodedUrl).toContain(`${expectedBody}`);
  }
}
export default SimulationResultPage;
