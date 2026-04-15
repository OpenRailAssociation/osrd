import { expect, type Locator, type Page } from '@playwright/test';

import OpSimulationResultPage from './simulation-results-page';
import { getCleanText, isGreyed, isOverflowing } from '../../utils';
import type { Waypoint } from '../../utils/manchette';
import type { SimulationResultsTranslations } from '../../utils/types';

class GetManchetteComponent extends OpSimulationResultPage {
  private readonly spaceTimeChartMenuButton: Locator;
  private readonly spaceTimeChartCloseSettingsButton: Locator;
  private readonly spaceTimeChartSettingsPanel: Locator;
  private readonly spaceTimeChartCheckboxItems: Locator;
  private readonly manchetteMenuButton: Locator;
  private readonly manchetteVisibilityButton: Locator;
  private readonly waypointsList: Locator;
  private readonly waypointsPanel: Locator;
  private readonly waypointItems: Locator;
  private readonly waypointPanelFooter: Locator;
  private readonly waypointCancelButton: Locator;
  private readonly waypointSaveButton: Locator;
  private readonly speedSpaceChartZoomButton: Locator;
  private readonly speedSpaceChartResetButton: Locator;
  private readonly speedSpaceChartRangerSlider: Locator;
  private readonly manchetteActionsButton: Locator;
  private readonly manchetteZoomInButton: Locator;
  private readonly manchetteZoomOutButton: Locator;
  private readonly manchetteResetButton: Locator;
  private readonly manchetteKmModeButton: Locator;
  private readonly manchetteLinearModeButton: Locator;
  private readonly warpedMapButton: Locator;
  private readonly simulationWarpedMap: Locator;
  private readonly manchetteSpaceTimeDiagramRef: Locator;
  private readonly hideWaypointMenuButton: Locator;
  private readonly occupancyMenuButton: Locator;
  private readonly closeTrackOccupancyPanelButton: Locator;
  private readonly trackOccupancyManchette: Locator;

  constructor(page: Page) {
    super(page);
    this.spaceTimeChartMenuButton = this.spaceTimeChart.getByTestId('menu-button');
    this.spaceTimeChartCloseSettingsButton = page.getByTestId('settings-panel-close-button');
    this.spaceTimeChartSettingsPanel = page.getByTestId('settings-panel');
    this.spaceTimeChartCheckboxItems = this.spaceTimeChartSettingsPanel.getByRole('checkbox');
    this.manchetteMenuButton = this.simulationResults.getByTestId('board-header-button').first();
    this.manchetteVisibilityButton = page.getByTestId('manchette-waypoints-visibility-button');
    this.waypointsList = page.getByTestId('waypoint-base-info');
    this.waypointsPanel = page.getByTestId('waypoints-panel-dialog');
    this.waypointItems = page.getByTestId('waypoint-item');
    this.waypointPanelFooter = page.getByTestId('waypoints-panel-footer');
    this.waypointCancelButton = this.waypointPanelFooter.locator('button.cancel');
    this.waypointSaveButton = this.waypointPanelFooter.locator('button.primary');
    this.manchetteActionsButton = page.getByTestId('manchette-actions');
    this.manchetteZoomInButton = this.manchetteActionsButton.getByTestId('zoom-in-button');
    this.manchetteZoomOutButton = this.manchetteActionsButton.getByTestId('zoom-out-button');
    this.manchetteResetButton = this.manchetteActionsButton.getByTestId('reset-zoom-button');
    this.manchetteKmModeButton = this.manchetteActionsButton.getByTestId('km-mode-button');
    this.manchetteLinearModeButton = this.manchetteActionsButton.getByTestId('linear-mode-button');
    this.speedSpaceChartRangerSlider = this.manchetteSpaceTimeChart.getByTestId('range-slider');
    this.speedSpaceChartZoomButton = this.spaceTimeChart.getByTestId('zoom-button');
    this.speedSpaceChartResetButton = this.spaceTimeChart.getByTestId('zoom-reset-button');
    this.warpedMapButton = page.getByTestId('warped-map-button');
    this.simulationWarpedMap = page.getByTestId('simulation-warped-map');
    this.manchetteSpaceTimeDiagramRef = page.getByTestId('manchette-spacetimediagram-ref');
    this.hideWaypointMenuButton = page.getByTestId('hide-waypoint-menu-button');
    this.occupancyMenuButton = page.getByTestId('occupancy-menu-button');
    this.closeTrackOccupancyPanelButton = page.getByTestId('close-track-occupancy-panel');
    this.trackOccupancyManchette = page.getByTestId('track-occupancy-manchette');
  }

  private getWaypointNameListLocator(index: number): Locator {
    return this.page.getByTestId('waypoint-name').nth(index);
  }

  private getWaypointChListLocator(index: number): Locator {
    return this.waypointsList.nth(index).getByTestId('waypoint-ch');
  }

  private getWaypointOffsetListLocator(index: number): Locator {
    return this.waypointsList.nth(index).getByTestId('waypoint-position');
  }

  private getWaypointNamePanelLocator(index: number): Locator {
    return this.waypointItems.nth(index).getByTestId('waypoint-name');
  }

  private getWaypointChPanelLocator(index: number): Locator {
    return this.waypointItems.nth(index).getByTestId('waypoint-ch');
  }

  private getWaypointOffsetPanelLocator(index: number): Locator {
    return this.waypointItems.nth(index).getByTestId('waypoint-point-offset');
  }

  private getWaypointCheckboxLocator(index: number): Locator {
    return this.waypointItems.nth(index).getByTestId('waypoint-checkbox');
  }

  private async expectVisibleEnabled(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
    await expect(locator).toBeEnabled();
  }

  async openSpaceTimeChartSettingsPanel(): Promise<void> {
    await this.spaceTimeChartMenuButton.click();
    await expect(this.spaceTimeChartSettingsPanel).toBeVisible();
  }

  async openManchettePanel(): Promise<void> {
    await expect(this.manchetteMenuButton).toBeVisible();
    await this.manchetteMenuButton.click();
    await expect(this.manchetteVisibilityButton).toBeVisible();
    await this.manchetteVisibilityButton.click();
    await expect(this.waypointsPanel).toBeVisible();
    await expect(this.waypointCancelButton).toBeVisible();
    await expect(this.waypointSaveButton).toBeVisible();
  }

  async closeWaypointPanel(): Promise<void> {
    await this.waypointCancelButton.click();
    await expect(this.waypointsPanel).not.toBeVisible();
  }

  async getWaypointsPanelData(): Promise<Waypoint[]> {
    const count = await this.waypointItems.count();
    return Promise.all(
      [...Array(count).keys()].map(async (waypointIndex) => {
        const [name, ch, offset, checked] = await Promise.all([
          getCleanText(this.getWaypointNamePanelLocator(waypointIndex)),
          getCleanText(this.getWaypointChPanelLocator(waypointIndex)),
          getCleanText(this.getWaypointOffsetPanelLocator(waypointIndex)),
          this.getWaypointCheckboxLocator(waypointIndex).isChecked(),
        ]);

        return { name, ch, offset, checked };
      })
    );
  }

  async getWaypointsListData(expectedCount: number): Promise<Waypoint[]> {
    await expect(this.waypointsList.first()).toBeVisible();
    await expect(this.waypointsList).toHaveCount(expectedCount);
    return Promise.all(
      [...Array(expectedCount).keys()].map(async (waypointIndex) => {
        let ch;
        const [name, offset] = await Promise.all([
          getCleanText(this.getWaypointNameListLocator(waypointIndex)),
          getCleanText(this.getWaypointOffsetListLocator(waypointIndex)),
        ]);
        if ((await this.getWaypointChListLocator(waypointIndex).count()) > 0) {
          await expect(this.getWaypointChListLocator(waypointIndex)).toBeVisible();
          ch = await getCleanText(this.getWaypointChListLocator(waypointIndex));
        }
        return { name, ch, offset };
      })
    );
  }

  async selectAllSpaceTimeChartCheckboxes(): Promise<void> {
    await this.openSpaceTimeChartSettingsPanel();
    const checkboxes = await this.spaceTimeChartCheckboxItems.all();
    await Promise.all(checkboxes.map((checkbox) => checkbox.click({ force: true })));
    await this.spaceTimeChartCloseSettingsButton.click();
  }
  async expandWarpedMap(): Promise<void> {
    await this.expectVisibleEnabled(this.warpedMapButton);
    await this.warpedMapButton.click();
    await expect(this.simulationWarpedMap).toBeVisible();
  }

  async collapseWarpedMap(): Promise<void> {
    await this.expectVisibleEnabled(this.warpedMapButton);
    await this.warpedMapButton.click();
    await expect(this.simulationWarpedMap).not.toBeVisible();
  }

  async zoomInAndResetManchette(): Promise<void> {
    await this.expectVisibleEnabled(this.manchetteZoomInButton);
    await expect(this.manchetteZoomOutButton).toBeVisible();
    await expect(this.manchetteZoomOutButton).toBeDisabled();

    await this.manchetteZoomInButton.click({ clickCount: 5 });

    await expect
      .poll(async () => await isOverflowing(this.manchetteSpaceTimeDiagramRef))
      .toBe(true);

    await this.expectVisibleEnabled(this.manchetteZoomOutButton);
    await this.expectVisibleEnabled(this.manchetteResetButton);

    await this.manchetteResetButton.click();

    await expect
      .poll(async () => await isOverflowing(this.manchetteSpaceTimeDiagramRef))
      .toBe(false);
  }

  async assertDefaultSliderValue(): Promise<void> {
    await expect(this.speedSpaceChartRangerSlider).toBeVisible();
    await expect
      .poll(async () => Number(await this.speedSpaceChartRangerSlider.inputValue()))
      .toBeCloseTo(64); //("63.81344412635098 default value ")
  }

  async setRangeSliderValue(value: string): Promise<void> {
    await expect(this.speedSpaceChartRangerSlider).toBeVisible();
    await this.speedSpaceChartRangerSlider.fill(value);
    await expect
      .poll(async () => Number(await this.speedSpaceChartRangerSlider.inputValue()))
      .toBe(Number(value));
  }

  async adjustAndResetGetZoom(): Promise<void> {
    await this.expectVisibleEnabled(this.speedSpaceChartZoomButton);
    await expect(this.speedSpaceChartResetButton).toHaveClass(/reset-button-disabled/);

    await this.speedSpaceChartRangerSlider.fill('20');

    await expect(this.speedSpaceChartResetButton).not.toHaveClass(/reset-button-disabled/);
    await this.speedSpaceChartResetButton.click();
    await expect(this.speedSpaceChartResetButton).toHaveClass(/reset-button-disabled/);
    await this.assertDefaultSliderValue();
  }

  async toggleLinearKmMode(): Promise<void> {
    await expect(this.manchetteKmModeButton).toBeVisible();
    await expect(this.manchetteLinearModeButton).toBeVisible();

    // initial state assertions
    expect(await isGreyed(this.manchetteKmModeButton)).toBe(false);
    expect(await isGreyed(this.manchetteLinearModeButton)).toBe(true);

    // linear on
    await this.manchetteLinearModeButton.click();
    expect(await isGreyed(this.manchetteLinearModeButton)).toBe(false);
    expect(await isGreyed(this.manchetteKmModeButton)).toBe(true);

    // back to km
    await this.manchetteKmModeButton.click();
    expect(await isGreyed(this.manchetteKmModeButton)).toBe(false);
    expect(await isGreyed(this.manchetteLinearModeButton)).toBe(true);
  }

  async openWayPointMenu(index = 0, isRequestedPoint = false) {
    await this.getWaypointNameListLocator(index).click();
    await expect(this.hideWaypointMenuButton).toBeVisible();
    if (isRequestedPoint) {
      await expect(this.occupancyMenuButton).toBeHidden();
    } else {
      await expect(this.occupancyMenuButton).toBeVisible();
    }
  }

  async openTrackOccupancyPanel(index = 0, translations: SimulationResultsTranslations) {
    await this.openWayPointMenu(index);
    await expect(this.occupancyMenuButton).toHaveText(translations.waypointMenu.showOccupancy);
    await this.occupancyMenuButton.click();
    await expect(this.trackOccupancyManchette).toBeVisible();
    await expect(this.closeTrackOccupancyPanelButton).toBeVisible();
  }

  async closeTrackOccupancyPanel(index = 0, translations: SimulationResultsTranslations) {
    await this.openWayPointMenu(index);
    await expect(this.occupancyMenuButton).toHaveText(translations.waypointMenu.hideOccupancy);
    await this.occupancyMenuButton.click();
    await expect(this.trackOccupancyManchette).toBeHidden();
    await expect(this.closeTrackOccupancyPanelButton).toBeHidden();
  }

  async hideWaypoint(waypointIndex = 0, isRequestedPoint = false) {
    await this.openWayPointMenu(waypointIndex, isRequestedPoint);
    await this.hideWaypointMenuButton.click();
  }

  async verifyVisibleWaypointsCount(expectedWaypoints: number) {
    await expect(this.waypointsList).toHaveCount(expectedWaypoints);
  }

  async verifyWaypointsCheckedState(expectedChecked: number, expectedTotal: number) {
    const totalWaypoints = await this.waypointItems.count();
    let checkedWaypoints = 0;

    for (let index = 0; index < totalWaypoints; index++) {
      const checkbox = this.getWaypointCheckboxLocator(index);
      if (await checkbox.isChecked()) checkedWaypoints++;
    }

    expect(totalWaypoints, 'Total waypoint items').toBe(expectedTotal);
    expect(checkedWaypoints, 'Checked waypoint items').toBe(expectedChecked);
  }
}

export default GetManchetteComponent;
