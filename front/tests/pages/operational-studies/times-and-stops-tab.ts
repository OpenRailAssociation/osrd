import { type Locator, type Page, expect } from '@playwright/test';

import { getTranslations } from '../../utils';
import { cleanWhitespace } from '../../utils/dataNormalizer';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';

const enTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

class TimesAndStopsTab {
  readonly page: Page;

  readonly columnHeaders: Locator;

  private readonly activeRows: Locator;

  private readonly tableRows: Locator;

  readonly deleteButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.activeRows = page.locator('.dsg-container .dsg-row.activeRow');
    this.columnHeaders = page.locator(
      '[class^="dsg-cell dsg-cell-header"] .dsg-cell-header-container'
    );
    this.tableRows = page.locator('.dsg-row');
    this.deleteButtons = page.getByTestId('remove-via-button');
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
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });

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
    await rowLocator.waitFor({ state: 'attached' });
    const cell = rowLocator.locator('.dsg-cell').nth(columnIndex);
    await cell.waitFor();
    await cell.dblclick();

    // Fill the input field based on the presence of a placeholder
    if (inputPlaceholder) {
      await cell.getByPlaceholder(inputPlaceholder).fill(fillValue);
    } else {
      await cell.locator('.dsg-input').fill(fillValue);

      if (cleanWhitespace(header) === cleanWhitespace(translations.stopTime)) {
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

  // Verify delete buttons visibility and count
  async verifyDeleteButtons(expectedCount: number) {
    await expect(this.deleteButtons).toHaveCount(expectedCount);
    const deleteButtonsArray = this.deleteButtons;
    for (let buttonIndex = 0; buttonIndex < expectedCount; buttonIndex += 1) {
      await expect(deleteButtonsArray.nth(buttonIndex)).toBeVisible();
    }
  }

  // Retrieve and verify input table data
  async verifyInputTableData(expectedTableData: JSON) {
    const actualTableData = [];
    const rowCount = await this.tableRows.count();

    for (let rowIndex = 1; rowIndex < rowCount; rowIndex += 1) {
      const rowCells = this.tableRows.nth(rowIndex).locator('.dsg-cell .dsg-input');
      await rowCells.first().waitFor();
      const rowValues = await rowCells.evaluateAll((cells) =>
        cells.map((cell) => cell.getAttribute('value'))
      );
      actualTableData.push({ row: rowIndex, values: rowValues });
    }

    // Compare actual output to expected data
    expect(actualTableData).toEqual(expectedTableData);
  }
}

export default TimesAndStopsTab;
