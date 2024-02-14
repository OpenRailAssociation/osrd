/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '@playwright/test';
import PlaywrightCommonPage from './common-page-model';

export class PlaywrightRollingstockEditorPage extends PlaywrightCommonPage {
  readonly getNewRollingstockButton: Locator;

  readonly getSubmitRollingstockButton: Locator;

  readonly getRollingstockDetailsButton: Locator;

  readonly getSpeedEffortCurvesButton: Locator;

  readonly getRollingStockSpreedsheet: Locator;

  readonly getRollingStockSearchInput: Locator;

  readonly getRollingStockEditorList: Locator;

  constructor(page: Page) {
    super(page);
    this.getNewRollingstockButton = page.getByTestId('new-rollingstock-button');
    this.getSubmitRollingstockButton = page.getByTestId('submit-rollingstock-button');
    this.getRollingstockDetailsButton = page.getByTestId('tab-rollingstock-details');
    this.getSpeedEffortCurvesButton = page.getByTestId('tab-rollingstock-curves');
    this.getRollingStockSpreedsheet = page.locator('.Spreadsheet__table');
    this.getRollingStockSearchInput = page.locator('#searchfilter');
    this.getRollingStockEditorList = page.getByTestId('rollingstock-editor-list');
  }

  async navigateToPage() {
    await this.page.goto('/rolling-stock-editor/');
    await this.removeViteOverlay();
  }

  async clickOnNewRollingstockButton() {
    await this.getNewRollingstockButton.click();
  }

  async clickOnSubmitRollingstockButton() {
    await this.getSubmitRollingstockButton.click();
  }

  async clickOnRollingstockDetailsButton() {
    await this.getRollingstockDetailsButton.click();
  }

  async clickOnSpeedEffortCurvesButton() {
    await this.getSpeedEffortCurvesButton.click();
  }

  getRollingStockInputById(id: string) {
    return this.page.locator(`#${id}`);
  }

  getRollingStockInputByTestId(testId: string) {
    return this.page.getByTestId(testId);
  }

  getVelocityCellByRow(row: string) {
    return this.getRollingStockSpreedsheet.locator(`[row="${row}"]`).locator('td').first();
  }

  getEffortCellByRow(row: string) {
    return this.getRollingStockSpreedsheet.locator(`[row="${row}"]`).locator('td').last();
  }

  async setSpreedsheetCell(value: string, cell: Locator) {
    const inputStrings = value.toString().split('');
    await cell.dblclick();
    this.page.keyboard.press('Backspace');
    await Promise.all(
      inputStrings.map(async (digit) => {
        await this.page.keyboard.press(digit);
      })
    );
  }

  async setSpreedsheetRow(data: { row: string; velocity: string; effort: string }[]) {
    await Promise.all(
      data.map(async ({ row, effort, velocity }) => {
        const velocityCell = this.getVelocityCellByRow(row);
        const effortCell = this.getEffortCellByRow(row);
        await this.setSpreedsheetCell(velocity, velocityCell);
        await this.setSpreedsheetCell(effort, effortCell);
      })
    );
  }

  async fillAndCheckInputById(inputId: string, value: string | number, isTestId = false) {
    const input = isTestId
      ? this.getRollingStockInputByTestId(inputId)
      : this.getRollingStockInputById(inputId);

    await input.click();
    await input.fill(`${value}`);
    expect(await input.inputValue()).toBe(`${value}`);
  }
}
