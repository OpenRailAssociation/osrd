import { type Locator, type Page, expect } from '@playwright/test';

import { EMPTY_TIME_PLACEHOLDER } from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import {
  cleanTimeInput,
  cleanWhitespace,
  removeWhitespace,
  stripTimeColons,
} from '../../utils/data-normalizer';
import type { TimesStopsTableRow } from '../../utils/times-stops-table-types';
import OpSimulationResultPage from './simulation-results-page';

class TimesStopsTablePage extends OpSimulationResultPage {
  readonly dataRows: Locator;
  readonly dateSeparatorRows: Locator;
  private readonly newTimesStopsTable: Locator;
  private readonly durationCellClearButton: Locator;

  constructor(page: Page) {
    super(page);
    this.dataRows = this.timesStopsDataSheet.getByTestId('times-stops-data-row');
    this.dateSeparatorRows = this.timesStopsDataSheet.getByTestId('day-change-banner');
    this.newTimesStopsTable = this.timesStopsDataSheet.getByTestId('times-stops-table-new');
    this.durationCellClearButton = this.page.getByTestId('duration-cell-clear-btn');
  }

  getRow(index: number): Locator {
    return this.dataRows.nth(index);
  }

  // Read textContent without waiting for a missing element. Returns '' when absent.
  private async optionalText(locator: Locator): Promise<string> {
    if ((await locator.count()) === 0) return '';
    return (await locator.textContent()) ?? '';
  }

  private rowIndexCell(row: Locator): Locator {
    return row.getByTestId('row-index');
  }

  private stepStatusCell(row: Locator): Locator {
    return row.getByTestId('step-status');
  }

  private opFullName(row: Locator): Locator {
    return row.getByTestId('op-full-name');
  }

  private secondaryCode(row: Locator): Locator {
    return row.getByTestId('secondary-code');
  }

  private trackName(row: Locator): Locator {
    return row.getByTestId('track-name');
  }

  private requestedArrivalInput(row: Locator): Locator {
    return row.getByTestId('requested-arrival');
  }

  private computedArrival(row: Locator): Locator {
    return row.getByTestId('computed-arrival');
  }

  private durationCell(row: Locator): Locator {
    return row.getByTestId('duration-cell');
  }

  private requestedDepartureInput(row: Locator): Locator {
    return row.getByTestId('requested-departure');
  }

  private computedDeparture(row: Locator): Locator {
    return row.getByTestId('computed-departure');
  }

  private signalReceptionClosedCheckbox(row: Locator): Locator {
    return row.getByTestId('signal-reception-closed');
  }

  private shortSlipDistanceCheckbox(row: Locator): Locator {
    return row.getByTestId('short-slip-distance');
  }

  private powerRestrictionCombobox(row: Locator): Locator {
    return row.getByTestId('power-restriction-select');
  }

  private requestedTheoreticalMargin(row: Locator): Locator {
    return row.getByTestId('requested-theoretical-margin');
  }

  private computedTheoreticalMargin(row: Locator): Locator {
    return row.getByTestId('computed-theoretical-margin');
  }

  private realMargin(row: Locator): Locator {
    return row.getByTestId('real-margin');
  }

  private marginsDifference(row: Locator): Locator {
    return row.getByTestId('margins-difference');
  }

  private timeFromPreviousOp(row: Locator): Locator {
    return row.getByTestId('time-from-previous-op');
  }

  private totalTravelTime(row: Locator): Locator {
    return row.getByTestId('total-travel-time');
  }

  private opNameDot(row: Locator): Locator {
    return row.getByTestId('op-name-dot');
  }

  private marginUnitBtnPercent(row: Locator): Locator {
    return this.requestedTheoreticalMargin(row).getByTestId('margin-unit-btn-percent');
  }

  private marginUnitBtnMinPer100km(row: Locator): Locator {
    return this.requestedTheoreticalMargin(row).getByTestId('margin-unit-btn-min-per-100km');
  }

  private marginCellPlaceholder(row: Locator): Locator {
    return this.requestedTheoreticalMargin(row).getByTestId('input-cell-placeholder');
  }

  private marginCellEditable(row: Locator): Locator {
    return this.requestedTheoreticalMargin(row).getByTestId('margin-cell-editable');
  }

  private marginCellInput(row: Locator): Locator {
    return this.requestedTheoreticalMargin(row).getByTestId('margin-cell-input');
  }

  async verifyOpFullNameNotEmpty(row: Locator): Promise<void> {
    await expect(this.opFullName(row)).not.toBeEmpty();
  }

  async verifyRowIndexText(row: Locator, text: string): Promise<void> {
    await expect(this.rowIndexCell(row)).toHaveText(text);
  }

  async verifyStopDuration(row: Locator, expectedDuration: string): Promise<void> {
    await expect(this.durationCell(row)).toHaveText(expectedDuration);
  }

  async verifySignalReceptionClosed(row: Locator, expectedChecked: boolean): Promise<void> {
    await expect(this.signalReceptionClosedCheckbox(row)).toBeChecked({ checked: expectedChecked });
  }

  async verifySignalReceptionEnabled(row: Locator, enabled: boolean): Promise<void> {
    await expect(this.signalReceptionClosedCheckbox(row)).toBeEnabled({ enabled });
  }

  async verifyShortSlipDistance(row: Locator, expectedChecked: boolean): Promise<void> {
    await expect(this.shortSlipDistanceCheckbox(row)).toBeChecked({ checked: expectedChecked });
  }

  async verifyShortSlipEnabled(row: Locator, enabled: boolean): Promise<void> {
    await expect(this.shortSlipDistanceCheckbox(row)).toBeEnabled({ enabled });
  }

  async verifyPowerRestriction(row: Locator, expectedValue: string): Promise<void> {
    await expect(this.powerRestrictionCombobox(row)).toBeVisible();
    await expect(this.powerRestrictionCombobox(row)).toHaveValue(expectedValue);
  }

  async verifyPowerRestrictionHasOption(row: Locator, value: string, count: number): Promise<void> {
    const testId =
      value === '' ? 'power-restriction-option-empty' : `power-restriction-option-${value}`;
    await expect(this.powerRestrictionCombobox(row).getByTestId(testId)).toHaveCount(count);
  }

  async verifyRequestedTheoreticalMarginText(row: Locator, marginText: string): Promise<void> {
    await expect(this.requestedTheoreticalMargin(row)).toHaveText(marginText);
    if (marginText === '') {
      await expect(this.marginCellPlaceholder(row)).toBeVisible();
    }
  }

  async verifyMarginPlaceholderVisible(row: Locator): Promise<void> {
    await expect(this.marginCellPlaceholder(row)).toBeVisible();
  }

  async verifyMarginPlaceholderHidden(row: Locator): Promise<void> {
    await expect(this.marginCellPlaceholder(row)).toBeHidden();
  }

  async verifyComputedTheoreticalMarginText(row: Locator, text: string): Promise<void> {
    await expect(this.computedTheoreticalMargin(row)).toHaveText(text);
  }

  async verifyComputedTheoreticalMarginAbsent(row: Locator): Promise<void> {
    await expect(this.computedTheoreticalMargin(row)).not.toBeAttached();
  }

  async verifyRealMarginText(row: Locator, text: string): Promise<void> {
    await expect(this.realMargin(row)).toHaveText(text);
  }

  async verifyRealMarginAbsent(row: Locator): Promise<void> {
    await expect(this.realMargin(row)).not.toBeAttached();
  }

  async verifyRowStatus(
    row: Locator,
    expectedStatus:
      | 'warning-margin'
      | 'warning-schedule'
      | 'success-schedule'
      | 'invalid-path-step'
      | ''
  ): Promise<void> {
    await expect(this.stepStatusCell(row)).toContainClass(expectedStatus);
  }

  async verifyRequestedArrivalValue(row: Locator, value: string): Promise<void> {
    await expect(this.requestedArrivalInput(row)).toHaveValue(value);
  }

  async verifyRequestedDepartureValue(row: Locator, value: string): Promise<void> {
    await expect(this.requestedDepartureInput(row)).toHaveValue(value);
  }

  async verifyDataRowCount(count: number): Promise<void> {
    await expect(this.dataRows).toHaveCount(count);
  }

  async verifyDateSeparatorVisible(): Promise<void> {
    await expect(this.dateSeparatorRows).toBeVisible();
  }

  async verifyComputedArrivalChanged(row: Locator, previousText: string): Promise<void> {
    expect(await this.getComputedArrivalText(row)).not.toBe(previousText);
  }

  async verifyComputedDepartureChanged(row: Locator, previousText: string): Promise<void> {
    expect(await this.getComputedDepartureText(row)).not.toBe(previousText);
  }

  async verifyComputedArrivalNotEmpty(row: Locator): Promise<void> {
    await expect(this.computedArrival(row)).not.toBeEmpty();
  }

  async verifyComputedArrivalAttached(row: Locator): Promise<void> {
    await expect(this.computedArrival(row)).toBeAttached();
  }

  async verifyComputedDepartureNotEmpty(row: Locator): Promise<void> {
    await expect(this.computedDeparture(row)).not.toBeEmpty();
  }

  async getComputedArrivalText(row: Locator): Promise<string> {
    return (await this.computedArrival(row).textContent()) ?? '';
  }

  async getComputedDepartureText(row: Locator): Promise<string> {
    return (await this.computedDeparture(row).textContent()) ?? '';
  }

  async getRealMarginText(row: Locator): Promise<string> {
    return (
      (await this.realMargin(row)
        .textContent()
        .catch(() => '')) ?? ''
    );
  }

  async clickSignalReceptionClosed(row: Locator): Promise<void> {
    await this.signalReceptionClosedCheckbox(row).click();
  }

  async clickShortSlipDistance(row: Locator): Promise<void> {
    await this.shortSlipDistanceCheckbox(row).click();
  }

  async editRequestedArrival(row: Locator, timeValue: string): Promise<void> {
    const input = this.requestedArrivalInput(row);
    const isEmpty = (await input.inputValue()) === EMPTY_TIME_PLACEHOLDER;
    if (isEmpty) {
      // Focus directly to avoid triggering FOCUSED_WITH_PREFILL via placeholder click
      await input.focus();
    } else {
      await input.click();
      // Move the cursor from the seconds section back to the hours
      await input.press('ArrowLeft');
      await input.press('ArrowLeft');
    }
    await input.pressSequentially(stripTimeColons(timeValue));
    await input.press('Enter');
  }

  async editRequestedDeparture(row: Locator, timeValue: string): Promise<void> {
    const input = this.requestedDepartureInput(row);
    const isEmpty = (await input.inputValue()) === EMPTY_TIME_PLACEHOLDER;
    if (isEmpty) {
      await input.focus();
    } else {
      await input.click();
      await input.press('ArrowLeft');
      await input.press('ArrowLeft');
    }
    await input.pressSequentially(stripTimeColons(timeValue));
    await input.press('Enter');
  }

  async clearRequestedArrival(row: Locator): Promise<void> {
    await this.requestedArrivalInput(row).click();
    await this.durationCellClearButton.click();
  }

  async editStopDuration(row: Locator, digits: string): Promise<void> {
    await this.durationCell(row).click();
    await this.durationCell(row).pressSequentially(digits);
    await this.durationCell(row).press('Enter');
  }

  async editRequestedMargin(row: Locator, value: string): Promise<void> {
    const placeholder = this.marginCellPlaceholder(row);
    if (await placeholder.isVisible()) {
      await placeholder.click();
    } else {
      await this.marginCellEditable(row).click();
    }
    await this.marginCellInput(row).fill(value);
    await this.marginCellInput(row).press('Enter');
  }

  async clearRequestedMargin(row: Locator): Promise<void> {
    await this.marginCellEditable(row).click();
    await this.marginCellInput(row).fill('');
    await this.marginCellInput(row).press('Enter');
  }

  async selectPowerRestriction(row: Locator, value: string): Promise<void> {
    await this.powerRestrictionCombobox(row).selectOption({ value });
  }

  async verifyColumnCount(row: Locator, expectedCount: number): Promise<void> {
    await expect(row.getByRole('cell')).toHaveCount(expectedCount);
  }

  async verifyComputedArrivalReadOnly(row: Locator): Promise<void> {
    await expect(
      this.computedArrival(row).getByTestId('computed-arrival-input')
    ).not.toBeAttached();
  }

  async verifyComputedDepartureIsEmpty(row: Locator): Promise<void> {
    await expect(this.computedDeparture(row)).toHaveClass(/cell-empty-dot/);
  }

  async verifyOpNameDotVisible(row: Locator): Promise<void> {
    await expect(this.opNameDot(row)).toBeVisible();
  }

  async verifyOpNameDotAbsent(row: Locator): Promise<void> {
    await expect(this.opNameDot(row)).not.toBeAttached();
  }

  async verifyMarginsDifferencePresent(row: Locator): Promise<void> {
    await expect(this.marginsDifference(row)).toBeVisible();
  }

  async verifyComputedTheoreticalMarginPresent(row: Locator): Promise<void> {
    await expect(this.computedTheoreticalMargin(row)).toBeVisible();
  }

  async verifyRealMarginPresent(row: Locator): Promise<void> {
    await expect(this.realMargin(row)).toBeVisible();
  }

  async verifyInheritedMarginStyle(row: Locator): Promise<void> {
    await expect(this.marginCellEditable(row)).toHaveClass(/inherited/);
  }

  async verifyActiveMarginUnit(row: Locator, unit: 'percent' | 'minPer100km'): Promise<void> {
    const btn =
      unit === 'percent' ? this.marginUnitBtnPercent(row) : this.marginUnitBtnMinPer100km(row);
    await expect(btn).toHaveClass(/unit-active/);
  }

  async switchMarginUnit(row: Locator, unit: 'percent' | 'minPer100km'): Promise<void> {
    const btn =
      unit === 'percent' ? this.marginUnitBtnPercent(row) : this.marginUnitBtnMinPer100km(row);
    await btn.click();
  }

  async editRequestedMarginWithUnit(
    row: Locator,
    value: string,
    unit: 'percent' | 'minPer100km'
  ): Promise<void> {
    const placeholder = this.marginCellPlaceholder(row);
    if (await placeholder.isVisible()) {
      await placeholder.click();
    } else {
      await this.marginCellEditable(row).click();
    }
    await this.switchMarginUnit(row, unit);
    await this.marginCellInput(row).fill(value);
    await this.marginCellInput(row).press('Enter');
  }

  // Wait for simulation triggered by a previous edit to complete.
  async waitForSimulation(): Promise<void> {
    await expect(this.newTimesStopsTable).not.toHaveClass(/computed-data-pending/, {
      timeout: 30_000,
    });
  }

  private async extractRow(row: Locator): Promise<TimesStopsTableRow> {
    const [
      indexText,
      statusClass,
      stationName,
      stationCh,
      trackName,
      reqArrivalValue,
      calculatedArrival,
      stopDurationText,
      reqDepartureValue,
      calculatedDeparture,
      signalReceptionClosed,
      shortSlipDistance,
      powerRestriction,
      reqTheoreticalText,
      computedTheoreticalText,
      realMarginText,
      differenceText,
      timeFromAboveWaypointText,
      totalArrivalTimeText,
    ] = await Promise.all([
      this.rowIndexCell(row).textContent(),
      this.stepStatusCell(row).getAttribute('class'),
      this.opFullName(row).textContent(),
      this.optionalText(this.secondaryCode(row)),
      this.trackName(row).textContent(),
      this.requestedArrivalInput(row).inputValue(),
      this.getComputedArrivalText(row),
      this.durationCell(row).textContent(),
      this.requestedDepartureInput(row).inputValue(),
      this.getComputedDepartureText(row),
      this.signalReceptionClosedCheckbox(row).isChecked(),
      this.shortSlipDistanceCheckbox(row).isChecked(),
      this.powerRestrictionCombobox(row).inputValue(),
      this.optionalText(this.requestedTheoreticalMargin(row)),
      this.optionalText(this.computedTheoreticalMargin(row)),
      this.optionalText(this.realMargin(row)),
      this.optionalText(this.marginsDifference(row)),
      this.timeFromPreviousOp(row).textContent(),
      this.totalTravelTime(row).textContent(),
    ]);

    return {
      index: parseInt(indexText ?? '0'),
      status: cleanWhitespace(statusClass) as TimesStopsTableRow['status'],
      stationName: cleanWhitespace(stationName),
      stationCh: cleanWhitespace(stationCh),
      trackName: cleanWhitespace(trackName),
      requestedArrival: cleanTimeInput(reqArrivalValue),
      calculatedArrival: cleanWhitespace(calculatedArrival),
      stopTime: removeWhitespace(stopDurationText),
      requestedDeparture: cleanTimeInput(reqDepartureValue),
      calculatedDeparture: cleanWhitespace(calculatedDeparture),
      signalReceptionClosed,
      shortSlipDistance,
      powerRestriction,
      margin: {
        requestedTheoretical: cleanWhitespace(reqTheoreticalText),
        computedTheoretical: removeWhitespace(computedTheoreticalText),
        real: removeWhitespace(realMarginText),
        difference: removeWhitespace(differenceText),
      },
      timeFromAboveWaypoint: cleanWhitespace(timeFromAboveWaypointText),
      totalArrivalTime: cleanWhitespace(totalArrivalTimeText),
    };
  }

  async verifyTimesStopsTableContent(expectedRows: TimesStopsTableRow[]): Promise<void> {
    await expect(this.dataRows).toHaveCount(expectedRows.length);
    const rows = await this.dataRows.all();
    const actualRows = await Promise.all(rows.map((row) => this.extractRow(row)));
    expect(actualRows).toEqual(expectedRows);
  }
}

export default TimesStopsTablePage;
