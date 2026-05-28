import { type Locator, type Page, expect } from '@playwright/test';

import { cleanTimeInput, cleanWhitespace, removeWhitespace } from '../../utils/data-normalizer';
import type { TimesStopsTableRow } from '../../utils/times-stops-table-types';
import OpSimulationResultPage from './simulation-results-page';

class TimesStopsTablePage extends OpSimulationResultPage {
  private readonly dataRows: Locator;

  constructor(page: Page) {
    super(page);
    this.dataRows = this.timesStopsDataSheet.getByTestId('times-stops-data-row');
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
      this.requestedArrivalInput(row).getAttribute('value'),
      this.computedArrival(row).textContent(),
      this.durationCell(row).textContent(),
      this.requestedDepartureInput(row).getAttribute('value'),
      this.computedDeparture(row).textContent(),
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
