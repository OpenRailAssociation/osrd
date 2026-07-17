import { expect, type Locator, type Page } from '@playwright/test';

import { readJsonFile } from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<{ manageTrainSchedule: FlatTranslations }>(
  'public/locales/fr/operational-studies.json'
).manageTrainSchedule;

class RouteTab {
  readonly page: Page;
  private readonly noOriginChosen: Locator;
  private readonly noDestinationChosen: Locator;
  private readonly searchByMainCodeButton: Locator;
  private readonly searchByMainCodeContainer: Locator;
  private readonly searchByMainCodeInput: Locator;
  private readonly searchByMainCodeSubmit: Locator;
  private readonly resultPathfindingDone: Locator;
  private readonly originInfo: Locator;
  private readonly destinationInfo: Locator;
  private readonly originDeleteButton: Locator;
  private readonly destinationDeleteButton: Locator;
  private readonly viaDeleteButton: Locator;
  private readonly addWaypointsButton: Locator;
  private readonly reverseItineraryButton: Locator;
  private readonly deleteItineraryButton: Locator;
  readonly droppedWaypoints: Locator;
  private readonly waypointSuggestions: Locator;
  private readonly viaModal: Locator;
  private readonly closeViaModalButton: Locator;
  private readonly missingParamMessage: Locator;
  private readonly pathfindingLoader: Locator;
  private readonly pathfindingInProgressMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.noOriginChosen = page.getByTestId('no-origin-chosen-text');
    this.noDestinationChosen = page.getByTestId('no-destination-chosen-text');
    this.searchByMainCodeButton = page.getByTestId('rocket-button');
    this.searchByMainCodeContainer = page.getByTestId('type-and-path-container');
    this.searchByMainCodeInput = page.getByTestId('type-and-path-input');
    this.searchByMainCodeSubmit = page.getByTestId('submit-search-by-main-code');
    this.resultPathfindingDone = page.getByTestId('result-pathfinding-done');
    this.originInfo = page.getByTestId('origin-op-info');
    this.destinationInfo = page.getByTestId('destination-op-info');
    this.originDeleteButton = page.getByTestId('delete-origin-button');
    this.destinationDeleteButton = page.getByTestId('delete-destination-button');
    this.viaDeleteButton = page.getByTestId('delete-via-button');
    this.addWaypointsButton = page.getByTestId('add-waypoints-button');
    this.reverseItineraryButton = page.getByTestId('reverse-itinerary-button');
    this.deleteItineraryButton = page.getByTestId('delete-itinerary-button');
    this.droppedWaypoints = page.getByTestId('dropped-via-info');
    this.waypointSuggestions = page.getByTestId('clickable-suggested-via');
    this.viaModal = page.getByTestId('manage-vias-modal');
    this.closeViaModalButton = page.getByLabel('Close');
    this.missingParamMessage = page.getByTestId('missing-params-info');
    this.pathfindingLoader = page.getByTestId('dots-loader');
    this.pathfindingInProgressMessage = page.getByTestId('pathfinding-in-progress');
  }

  // Get the name locator of a waypoint suggestion.
  private static getWaypointSuggestionNameLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-name');
  }

  // Get the secondary code locator of a waypoint suggestion.
  private static getWaypointSuggestionSecondaryCodeLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-secondary-code');
  }

  // Get the UIC locator of a waypoint suggestion.
  private static getWaypointSuggestionUicLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-uic');
  }

  // Get the distance locator of a waypoint suggestion.
  private static getWaypointSuggestionDistanceLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-distance');
  }

  // Get the name locator of a dropped waypoint.
  private static getWaypointDroppedNameLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-name');
  }

  // Get the secondary code locator of a dropped waypoint.
  private static getWaypointDroppedSecondaryCodeLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-secondary-code');
  }

  // Get the UIC locator of a dropped waypoint.
  private static getWaypointDroppedUicLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-uic');
  }

  // Get the locator of the origin by mainCode.
  private getOriginLocatorByMainCode(mainCode: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${mainCode}`);
  }

  // Get the locator of the destination by mainCode.
  private getDestinationLocatorByMainCode(mainCode: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${mainCode}`);
  }

  // Get the locator of the via by mainCode.
  private getViaLocatorByMainCode(mainCode: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${mainCode}`);
  }

  // Get the add button locator by via name.
  private getAddButtonLocatorByViaName(viaName: string): Locator {
    return this.page.getByTitle(viaName).getByTestId('suggested-via-add-button');
  }

  // Get the delete button locator by via name.
  private getDeleteButtonLocatorByViaName(viaName: string): Locator {
    return this.page.getByTitle(viaName).getByTestId('suggested-via-delete-button');
  }

  // Get the pathfinding marker on the map by marker name.
  private getMapPathfindingMarker(markerName: string): Locator {
    return this.page.locator('#map-container').getByText(markerName, { exact: true });
  }

  private async submitSearchByMainCode() {
    await this.searchByMainCodeSubmit.click();
  }

  async deleteItinerary() {
    await this.deleteItineraryButton.click();
  }

  // Verify that no route is selected and displays appropriate messages.
  async verifyNoSelectedRoute() {
    const isNoOriginChosenVisible = await this.noOriginChosen.isVisible();
    const isNoDestinationChosenVisible = await this.noDestinationChosen.isVisible();

    if (isNoOriginChosenVisible) {
      await expect(this.noOriginChosen).toHaveText(frTranslations.noOriginChosen);
    }
    if (isNoDestinationChosenVisible) {
      await expect(this.noDestinationChosen).toHaveText(frTranslations.noDestinationChosen);
    }
  }

  // Perform pathfinding by entering origin, destination, and optionally via mainCodes.
  async performPathfindingByMainCode({
    originMainCode,
    destinationMainCode,
    viaMainCode,
  }: {
    originMainCode: string;
    destinationMainCode: string;
    viaMainCode?: string;
  }): Promise<void> {
    await this.searchByMainCodeButton.click();
    await expect(this.searchByMainCodeContainer).toBeVisible();

    const inputMainCodeText = viaMainCode
      ? `${originMainCode} ${viaMainCode} ${destinationMainCode}`
      : `${originMainCode} ${destinationMainCode}`;

    await this.searchByMainCodeInput.fill(inputMainCodeText);

    const originLocator = this.getOriginLocatorByMainCode(originMainCode);
    const destinationLocator = this.getDestinationLocatorByMainCode(destinationMainCode);

    await expect(originLocator).toBeVisible();
    await expect(destinationLocator).toBeVisible();

    if (viaMainCode) {
      const viaLocator = this.getViaLocatorByMainCode(viaMainCode);
      await expect(viaLocator).toBeVisible();
    }

    const expectedOriginMainCode = await originLocator.innerText();
    const expectedDestinationMainCode = await destinationLocator.innerText();

    await this.submitSearchByMainCode();
    await expect(this.pathfindingLoader).toBeHidden();
    await expect(this.searchByMainCodeContainer).not.toBeVisible();
    await expect(this.resultPathfindingDone).toBeVisible();

    await expect(this.originInfo).toHaveText(expectedOriginMainCode);
    await expect(this.destinationInfo).toHaveText(expectedDestinationMainCode);
  }

  async reverseItinerary() {
    await this.reverseItineraryButton.click();
  }

  // Click the buttons to delete origin, destination, and via waypoints and verifies missing parameters message.
  async deleteOperationPoints() {
    // Ensure all buttons are rendered and visible before proceeding
    await Promise.all([
      expect(this.viaDeleteButton).toBeVisible(),
      expect(this.originDeleteButton).toBeVisible(),
      expect(this.destinationDeleteButton).toBeVisible(),
    ]);

    await this.viaDeleteButton.click();
    await this.originDeleteButton.click();
    await expect(this.pathfindingInProgressMessage).toBeHidden();
    await this.destinationDeleteButton.click();
    await expect(this.pathfindingInProgressMessage).toBeHidden();

    const expectedMessage = frTranslations.pathfindingMissingParams.replace(
      ': {{missingElements}}.',
      ''
    );
    await expect(this.missingParamMessage).toBeVisible();
    await expect(this.missingParamMessage).toContainText(expectedMessage);
  }

  // Click the add buttons for the specified via names.
  private async addVias(...viaNames: string[]) {
    for (const viaName of viaNames) {
      await this.getAddButtonLocatorByViaName(viaName).click();
      await expect(this.getDeleteButtonLocatorByViaName(viaName)).toBeVisible();
    }
  }

  // Verify that the specified markers are visible on the map.
  async verifyMapMarkers(...markerNames: string[]) {
    for (const markerName of markerNames) {
      await expect(this.getMapPathfindingMarker(markerName)).toBeVisible();
    }
  }

  // Validate the waypoint suggestions by checking the name, secondray code, UIC, and distance.
  private static async validateWaypointSuggestions(
    waypointSuggestion: Locator,
    expectedName: string,
    expectedSecondaryCode: string,
    expectedUic: string,
    expectedKm: string
  ) {
    await expect(RouteTab.getWaypointSuggestionNameLocator(waypointSuggestion)).toHaveText(
      expectedName
    );
    await expect(RouteTab.getWaypointSuggestionSecondaryCodeLocator(waypointSuggestion)).toHaveText(
      expectedSecondaryCode
    );
    await expect(RouteTab.getWaypointSuggestionUicLocator(waypointSuggestion)).toHaveText(
      expectedUic
    );
    await expect(RouteTab.getWaypointSuggestionDistanceLocator(waypointSuggestion)).toHaveText(
      expectedKm
    );
  }

  // Validate the added waypoints by checking the name, secondary code, and UIC.
  async validateAddedWaypoint(
    droppedWaypoint: Locator,
    expectedName: string,
    expectedSecondaryCode: string,
    expectedUic: string
  ) {
    await expect(RouteTab.getWaypointDroppedNameLocator(droppedWaypoint)).toHaveText(expectedName);
    await expect(RouteTab.getWaypointDroppedSecondaryCodeLocator(droppedWaypoint)).toHaveText(
      expectedSecondaryCode
    );
    await expect(RouteTab.getWaypointDroppedUicLocator(droppedWaypoint)).toHaveText(expectedUic);
  }

  // Add new waypoints by clicking the add button for suggested waypoints and verifying the added waypoints.
  async addNewWaypoints(
    suggestedWaypointsCount: number,
    waypointToAddNames: string[],
    expectedValues: { name: string; secondaryCode: string; uic: string; km: string }[]
  ) {
    await this.addWaypointsButton.click();
    await expect(this.viaModal).toBeVisible();
    await expect(this.waypointSuggestions).toHaveCount(suggestedWaypointsCount);

    let waypointSuggestionCount = 0;

    while (waypointSuggestionCount < expectedValues.length) {
      const waypointSuggestion = this.waypointSuggestions.nth(waypointSuggestionCount);
      const expectedValue = expectedValues[waypointSuggestionCount];

      await RouteTab.validateWaypointSuggestions(
        waypointSuggestion,
        expectedValue.name,
        expectedValue.secondaryCode,
        expectedValue.uic,
        expectedValue.km
      );

      waypointSuggestionCount += 1;
    }

    await this.addVias(...waypointToAddNames);
    await this.closeViaModalButton.click();

    let droppedWaypointCount = 0;

    while (droppedWaypointCount < expectedValues.length) {
      const droppedWaypoint = this.droppedWaypoints.nth(droppedWaypointCount);
      const expectedValue = expectedValues[droppedWaypointCount];

      await this.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.secondaryCode,
        expectedValue.uic
      );

      droppedWaypointCount += 1;
    }
  }
}
export default RouteTab;
