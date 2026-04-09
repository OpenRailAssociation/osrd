import { expect, type Locator, type Page } from '@playwright/test';

import { logger } from '../../logging-fixture';
import {
  assertSuggestedFilename,
  readJsonFile,
  saveDownloadToDir,
  triggerFileDownload,
} from '../../utils/file-utils';
import type { STDCMResultTableRow } from '../../utils/stdcm-types';

class SimulationResultPage {
  readonly page: Page;
  private readonly mapResultContainer: Locator;
  private readonly originResultMarker: Locator;
  private readonly destinationResultMarker: Locator;
  private readonly viaResultMarker: Locator;
  private readonly simulationResultTable: Locator;
  private readonly simulationTableRows: Locator;
  private readonly allViasButton: Locator;
  private readonly retainSimulationButton: Locator;
  private readonly downloadSimulationButton: Locator;
  private readonly startNewQueryButton: Locator;
  private readonly startNewQueryWithDataButton: Locator;
  private readonly feedbackCardContainer: Locator;
  private readonly feedbackTitle: Locator;
  private readonly feedbackDescription: Locator;
  private readonly feedbackButton: Locator;
  private readonly simulationItem: Locator;

  constructor(page: Page) {
    this.page = page;
    this.simulationItem = page.getByTestId('simulation-item-button');
    this.mapResultContainer = page.locator('#stdcm-map-result');
    this.originResultMarker = this.mapResultContainer.getByTestId('stdcm-map-result-marker-origin');
    this.destinationResultMarker = this.mapResultContainer.getByTestId(
      'stdcm-map-result-marker-destination'
    );
    this.viaResultMarker = this.mapResultContainer.getByTestId('stdcm-map-result-marker-via');
    this.simulationResultTable = page.getByTestId('table-results');
    this.simulationTableRows = this.simulationResultTable.locator('tbody tr');
    this.allViasButton = page.getByTestId('all-vias-button');
    this.retainSimulationButton = page.getByTestId('retain-simulation-button');
    this.downloadSimulationButton = page.getByTestId('download-simulation');
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
    const jsonData: STDCMResultTableRow[] = readJsonFile(tableDataPath);

    await expect(this.simulationTableRows.first()).toBeVisible();

    const tableRows = await this.simulationTableRows.evaluateAll((rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll('td');
        const getCellText = (index: number): string => cells[index]?.textContent?.trim() || '';

        return {
          index: Number(getCellText(0)) || 0,
          operationalPoint: getCellText(1),
          code: getCellText(2),
          endStop: getCellText(3),
          passageStop: getCellText(4),
          startStop: getCellText(5),
          weight: getCellText(6),
          refEngine: getCellText(7),
        };
      })
    );

    expect(tableRows).toHaveLength(jsonData.length);

    jsonData.forEach((jsonRow, index) => {
      const tableRow = tableRows[index];

      if (!tableRow) {
        logger.error(`Row ${index + 1} is missing in the HTML table`);
        return;
      }

      expect({
        operationalPoint: tableRow.operationalPoint,
        code: tableRow.code,
        endStop: tableRow.endStop,
        passageStop: tableRow.passageStop,
        startStop: tableRow.startStop,
        weight: tableRow.weight,
        refEngine: tableRow.refEngine,
      }).toEqual({
        operationalPoint: jsonRow.operationalPoint,
        code: jsonRow.code,
        endStop: jsonRow.endStop,
        passageStop: jsonRow.passageStop,
        startStop: jsonRow.startStop,
        weight: jsonRow.weight,
        refEngine: jsonRow.refEngine,
      });
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

  async startNewQueryWithData() {
    await this.startNewQueryWithDataButton.click();
  }

  async startNewQueryWithoutData() {
    await this.startNewQueryButton.click();
  }

  async downloadSimulation(downloadDir: string): Promise<void> {
    await expect(this.downloadSimulationButton).toBeVisible();

    const download = await triggerFileDownload(this.page, this.downloadSimulationButton);

    assertSuggestedFilename(download, /^Stdcm.*\.pdf$/);

    const downloadPath = await saveDownloadToDir(download, downloadDir);

    logger.info(`The PDF was successfully downloaded to: ${downloadPath}`);
  }

  async startNewQuery() {
    await this.startNewQueryButton.click();
  }

  async mapMarkerResultVisibility(): Promise<void> {
    const elements = [this.originResultMarker, this.destinationResultMarker, this.viaResultMarker];
    await Promise.all(elements.map((element) => expect(element).toBeVisible()));
  }

  async verifySimulationDetails({
    simulationIndex,
    simulationLengthAndDuration,
    validSimulationNumber,
    noOutputSimulationName,
  }: {
    simulationIndex: number;
    simulationLengthAndDuration?: string | null;
    validSimulationNumber?: number;
    noOutputSimulationName: string;
  }): Promise<void> {
    const noCapacityLengthAndDuration = '— ';

    await this.simulationItem.nth(simulationIndex).click();

    const isResultTableVisible = await this.simulationResultTable.isVisible();

    const expectedSimulationName = isResultTableVisible
      ? `Simulation n°${validSimulationNumber}`
      : noOutputSimulationName;

    const actualSimulationName = await this.getSimulationNameLocator(simulationIndex).textContent();
    expect(actualSimulationName).toEqual(expectedSimulationName);

    const expectedLengthAndDuration = isResultTableVisible
      ? simulationLengthAndDuration
      : noCapacityLengthAndDuration;

    const actualLengthAndDuration =
      await this.getSimulationLengthAndDurationLocator(simulationIndex).textContent();

    expect(actualLengthAndDuration).toEqual(expectedLengthAndDuration);
  }

  async verifyFeedbackCardVisibility(): Promise<void> {
    const elements = [
      this.simulationResultTable,
      this.feedbackCardContainer,
      this.feedbackTitle,
      this.feedbackDescription,
      this.feedbackButton,
    ];

    await Promise.all(elements.map((element) => expect(element).toBeVisible()));
  }

  async verifyMailRedirection(
    expectedSubject: string,
    expectedBody: string,
    expectedEmail: string
  ): Promise<void> {
    const mailtoUrl = await this.feedbackButton.getAttribute('href');

    expect(mailtoUrl).toBeTruthy();

    const decodedMailtoUrl = decodeURIComponent(mailtoUrl ?? '');

    expect(decodedMailtoUrl).toContain(expectedEmail);
    expect(decodedMailtoUrl).toContain(expectedSubject);
    expect(decodedMailtoUrl).toContain(expectedBody);
  }
}

export default SimulationResultPage;
