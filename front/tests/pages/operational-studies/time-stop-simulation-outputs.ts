import { type Locator, type Page, expect } from '@playwright/test';

import OpSimulationResultPage from './simulation-results-page';
import { normalizeStationData } from '../../utils/data-normalizer';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations, StationData } from '../../utils/types';

const frTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

class TimeAndStopSimulationOutputs extends OpSimulationResultPage {
  private readonly columnHeaders: Locator;

  private readonly tableRows: Locator;

  constructor(page: Page) {
    super(page);
    this.columnHeaders = page.locator(
      '.dsg-cell.dsg-cell-header:not(.dsg-cell-gutter) .dsg-cell-header-container'
    );
    this.tableRows = page.locator('.time-stops-datasheet .dsg-row');
  }

  // Retrieve the cell value based on the locator type
  private static async getCellValue(cell: Locator, isInput: boolean = true): Promise<string> {
    return isInput
      ? (await cell.locator('input').getAttribute('value'))?.trim() || ''
      : (await cell.textContent())?.trim() || '';
  }

  // Extract the column index for each header name
  private async getHeaderIndexMap(): Promise<Record<string, number>> {
    const headers = await this.columnHeaders.allTextContents();
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const cleanedHeader = header.trim();
      headerMap[cleanedHeader] = index;
    });
    return headerMap;
  }

  async getOutputTableData(expectedTableData: StationData[]) {
    const actualTableData: StationData[] = [];

    const headerIndexMap = await this.getHeaderIndexMap();
    const rowCount = await this.tableRows.count();

    // Iterate through each active row and extract data based on header mappings
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const row = this.tableRows.nth(rowIndex);
      await expect(row).toBeVisible();

      // Extract cells from the current row
      const cells = row.locator('.dsg-cell.dsg-cell-disabled');

      const [
        stationName,
        stationCh,
        trackName,
        requestedArrival,
        requestedDeparture,
        stopTime,
        signalReceptionClosed,
        shortSlipDistance,
        theoreticalMargin,
        theoreticalMarginS,
        actualMargin,
        marginDifference,
        calculatedArrival,
        calculatedDeparture,
      ] = await Promise.all([
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.name]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(cells.nth(headerIndexMap[frTranslations.ch])),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.trackName]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.arrivalTime]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.departureTime]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.stopTime])
        ),
        cells
          .nth(headerIndexMap[frTranslations.receptionOnClosedSignal])
          .locator('input.dsg-checkbox')
          .isChecked(),
        cells
          .nth(headerIndexMap[frTranslations.shortSlipDistance])
          .locator('input.dsg-checkbox')
          .isChecked(),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.theoreticalMargin]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.theoreticalMarginSeconds])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.realMargin])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.diffMargins])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.calculatedArrivalTime])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[frTranslations.calculatedDepartureTime])
        ),
      ]);

      // Push the row data into the actual table data array
      actualTableData.push({
        stationName,
        stationCh,
        trackName,
        requestedArrival,
        requestedDeparture,
        stopTime,
        signalReceptionClosed,
        shortSlipDistance,
        margin: {
          theoretical: theoreticalMargin,
          theoreticalS: theoreticalMarginS,
          actual: actualMargin,
          difference: marginDifference,
        },
        calculatedArrival,
        calculatedDeparture,
      });
    }

    // // Normalize and compare data
    const normalizedActualData = normalizeStationData(actualTableData);
    const normalizedExpectedData = normalizeStationData(expectedTableData);
    expect(normalizedActualData).toEqual(normalizedExpectedData);
  }
}

export default TimeAndStopSimulationOutputs;
