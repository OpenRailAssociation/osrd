import { type Locator, type Page, expect } from '@playwright/test';

import { cleanWhitespace } from '../../utils/data-normalizer';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';

const frTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

class TimesAndStopsTab {
  private readonly page: Page;

  readonly columnHeaders: Locator;

  private readonly activeRows: Locator;

  private readonly tableRows: Locator;

  private readonly clearButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.activeRows = page.locator('.dsg-container .dsg-row.activeRow');
    this.columnHeaders = page.locator(
      '[class^="dsg-cell dsg-cell-header"] .dsg-cell-header-container'
    );
    this.tableRows = page.locator('.dsg-row');
    this.clearButtons = page.getByTestId('remove-via-button');
  }

  // Verify the count of rows with 'activeRow' class
  async verifyActiveRowsCount(expectedCount: number) {
    const activeRowCount = await this.activeRows.count();
    expect(activeRowCount).toBe(expectedCount);
  }

  async fillTableCellByStationAndHeader(
    stationName: string,
    header: string,
    fillValue: string,
    inputPlaceholder?: string
  ) {
    const expectedColumnHeader = cleanWhitespace(header);

    const headersCount = await this.columnHeaders.count();
    let columnIndex = -1;

    for (let headerIndex = 0; headerIndex < headersCount; headerIndex += 1) {
      const columnHeader = await this.columnHeaders.nth(headerIndex).innerText();
      const currentColumnHeader = cleanWhitespace(columnHeader);
      if (currentColumnHeader === expectedColumnHeader) {
        columnIndex = headerIndex + 1;
        break;
      }
    }

    const rowLocator = this.tableRows
      .filter({
        has: this.page.locator(`input.dsg-input[value="${stationName}"]`),
      })
      .first();
    await expect(rowLocator).toBeAttached();
    const cell = rowLocator.locator('.dsg-cell').nth(columnIndex);
    await expect(cell).toBeVisible();
    await cell.dblclick();

    // Fill the input field based on the presence of a placeholder
    if (inputPlaceholder) {
      await cell.getByPlaceholder(inputPlaceholder).fill(fillValue);
    } else {
      await cell.locator('.dsg-input').fill(fillValue);

      if (cleanWhitespace(header) === cleanWhitespace(frTranslations.stopTime)) {
        await cell.locator('.dsg-input').press('Enter');

        if (stationName === 'Mid_West_station') {
          const signalReceptionCheckbox = rowLocator.locator('input[type="checkbox"]').nth(0);
          await signalReceptionCheckbox.click();
          await expect(signalReceptionCheckbox).toBeChecked();

          const shortSlipCheckbox = rowLocator.locator('input[type="checkbox"]').nth(1);
          const isShortSlipEnabled = await shortSlipCheckbox.isEnabled();
          if (!isShortSlipEnabled) {
            throw new Error('The shortSlipDistance checkbox is not enabled');
          }

          await shortSlipCheckbox.click();
          await expect(shortSlipCheckbox).toBeChecked();
        }
      }
    }
  }

  // Verify clear buttons visibility and count
  async verifyClearButtons(expectedCount: number) {
    await expect(this.clearButtons).toHaveCount(expectedCount);
    const clearButtonsArray = this.clearButtons;
    for (let buttonIndex = 0; buttonIndex < expectedCount; buttonIndex += 1) {
      await expect(clearButtonsArray.nth(buttonIndex)).toBeVisible();
    }
  }

  // Retrieve and verify input table data
  async verifyInputTableData(expectedTableData: JSON) {
    const actualTableData = [];
    const rowCount = await this.tableRows.count();

    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const rowCells = this.tableRows.nth(rowIndex).locator('.dsg-cell .dsg-input');
      await expect(rowCells.first()).toBeVisible();
      const rowValues = await rowCells.evaluateAll((cells) =>
        cells.map((cell) => cell.getAttribute('value'))
      );
      actualTableData.push({ row: rowIndex, values: rowValues });
    }

    // Compare actual output to expected data
    expect(actualTableData).toEqual(expectedTableData);
  }

  async clearRow(rowIndex: number) {
    await this.clearButtons.nth(rowIndex).click();
  }
}

export default TimesAndStopsTab;
