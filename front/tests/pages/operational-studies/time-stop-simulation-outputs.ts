import { type Locator, type Page, expect } from '@playwright/test';

import ScenarioTimetableSection from './scenario-timetable-section';
import { LOAD_PAGE_TIMEOUT } from '../../assets/constants/timeout-const';
import { getTranslations } from '../../utils';
import { normalizeStationData } from '../../utils/data-normalizer';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations, StationData } from '../../utils/types';

const enTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

class TimeAndStopSimulationOutputs extends ScenarioTimetableSection {
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
  static async getCellValue(cell: Locator, isInput: boolean = true): Promise<string> {
    return isInput
      ? (await cell.locator('input').getAttribute('value'))?.trim() || ''
      : (await cell.textContent())?.trim() || '';
  }

  // Extract the column index for each header name
  async getHeaderIndexMap(): Promise<Record<string, number>> {
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
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    const headerIndexMap = await this.getHeaderIndexMap();
    const rowCount = await this.tableRows.count();

    // Iterate through each active row and extract data based on header mappings
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const row = this.tableRows.nth(rowIndex);
      await row.waitFor();

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
          cells.nth(headerIndexMap[translations.name]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(cells.nth(headerIndexMap[translations.ch])),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.trackName]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.arrivalTime]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.departureTime]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(cells.nth(headerIndexMap[translations.stopTime])),
        cells
          .nth(headerIndexMap[translations.receptionOnClosedSignal])
          .locator('input.dsg-checkbox')
          .isChecked(),
        cells
          .nth(headerIndexMap[translations.shortSlipDistance])
          .locator('input.dsg-checkbox')
          .isChecked(),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.theoreticalMargin]),
          false
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.theoreticalMarginSeconds])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.realMargin])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.diffMargins])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.calculatedArrivalTime])
        ),
        TimeAndStopSimulationOutputs.getCellValue(
          cells.nth(headerIndexMap[translations.calculatedDepartureTime])
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

  // Wait for the Times and Stops simulation data sheet to be fully loaded
  async verifyTimesStopsDataSheetVisibility(): Promise<void> {
    await this.timesStopsDataSheet.waitFor({ timeout: LOAD_PAGE_TIMEOUT });
    await this.timesStopsDataSheet.scrollIntoViewIfNeeded();
  }
}

export default TimeAndStopSimulationOutputs;
