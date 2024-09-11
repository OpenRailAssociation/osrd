import { type Locator, type Page, expect } from '@playwright/test';

import enTranslations from '../../public/locales/en/timesStops.json';
import frTranslations from '../../public/locales/fr/timesStops.json';
import { normalizeData, type StationData } from '../utils/dataNormalizer';

class OperationalStudiesOutputTablePage {
  readonly page: Page;

  readonly columnHeaders: Locator;

  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.columnHeaders = page.locator(
      '[class="dsg-cell dsg-cell-header"] .dsg-cell-header-container'
    );
    this.tableRows = page.locator('.osrd-simulation-container .time-stops-datasheet .dsg-row');
  }

  // Retrieve the cell value based on the locator type
  static async getCellValue(cell: Locator, isInput: boolean = true): Promise<string> {
    return isInput
      ? (await cell.locator('input').getAttribute('value'))?.trim() || ''
      : (await cell.textContent())?.trim() || '';
  }

  // Extract the column index for each header name
  async getHeaderIndexMap(): Promise<Record<string, number>> {
    await this.columnHeaders.first().waitFor({ state: 'visible' });
    const headers = await this.columnHeaders.allTextContents();
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const cleanedHeader = header.trim();
      headerMap[cleanedHeader] = index;
    });
    return headerMap;
  }

  async getOutputTableData(expectedTableData: StationData[], selectedLanguage: string) {
    const actualTableData: StationData[] = [];
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    const headerIndexMap = await this.getHeaderIndexMap();
    const rowCount = await this.tableRows.count();

    // Iterate through each active row and extract data based on header mappings
    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const row = this.tableRows.nth(rowIndex);
      await row.waitFor({ state: 'visible' });

      // Extract cells from the current row
      const cells = row.locator('.dsg-cell.dsg-cell-disabled');

      const [
        stationName,
        stationCh,
        requestedArrival,
        requestedDeparture,
        stopTime,
        signalReceptionClosed,
        theoreticalMargin,
        theoreticalMarginS,
        actualMargin,
        marginDifference,
        calculatedArrival,
        calculatedDeparture,
      ] = await Promise.all([
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.name])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(cells.nth(headerIndexMap.Ch)),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.arrivalTime]),
          false
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.departureTime]),
          false
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.stopTime])
        ),
        await cells
          .nth(headerIndexMap[translations.receptionOnClosedSignal])
          .locator('input.dsg-checkbox')
          .isChecked(),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.theoreticalMargin])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.theoreticalMarginSeconds])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.realMargin])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.diffMargins])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.calculatedArrivalTime])
        ),
        await OperationalStudiesOutputTablePage.getCellValue(
          cells.nth(headerIndexMap[translations.calculatedDepartureTime])
        ),
      ]);

      // Push the row data into the actual table data array
      actualTableData.push({
        stationName,
        stationCh,
        requestedArrival,
        requestedDeparture,
        stopTime,
        signalReceptionClosed,
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
    const normalizedActualData = normalizeData(actualTableData);
    const normalizedExpectedData = normalizeData(expectedTableData);
    expect(normalizedActualData).toEqual(normalizedExpectedData);
  }
}

export default OperationalStudiesOutputTablePage;
