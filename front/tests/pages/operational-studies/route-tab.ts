import { expect, type Locator, type Page } from '@playwright/test';

import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<{ manageTimetableItem: FlatTranslations }>(
  'public/locales/fr/operational-studies.json'
).manageTimetableItem;

class RouteTab {
  readonly page: Page;

  private readonly noOriginChosen: Locator;

  private readonly noDestinationChosen: Locator;

  private readonly searchByTrigramButton: Locator;

  private readonly searchByTrigramContainer: Locator;

  private readonly searchByTrigramInput: Locator;

  private readonly searchByTrigramSubmit: Locator;

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
    this.searchByTrigramButton = page.getByTestId('rocket-button');
    this.searchByTrigramContainer = page.getByTestId('type-and-path-container');
    this.searchByTrigramInput = page.getByTestId('type-and-path-input');
    this.searchByTrigramSubmit = page.getByTestId('submit-search-by-trigram');
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

  // Get the CH locator of a waypoint suggestion.
  private static getWaypointSuggestionChLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-ch');
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

  // Get the CH locator of a dropped waypoint.
  private static getWaypointDroppedChLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-ch');
  }

  // Get the UIC locator of a dropped waypoint.
  private static getWaypointDroppedUicLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-uic');
  }

  // Get the locator of the origin by trigram.
  private getOriginLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
  }

  // Get the locator of the destination by trigram.
  private getDestinationLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
  }

  // Get the locator of the via by trigram.
  private getViaLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
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

  private async submitSearchByTrigram() {
    await this.searchByTrigramSubmit.click();
  }

  async deleteItinerary() {
    await this.deleteItineraryButton.click();
  }

  // Verify that no route is selected and displays appropriate messages.
  async verifyNoSelectedRoute() {
    const isNoOriginChosenVisible = await this.noOriginChosen.isVisible();
    const isNoDestinationChosenVisible = await this.noDestinationChosen.isVisible();

    if (isNoOriginChosenVisible) {
      const noOriginChosenText = await this.noOriginChosen.innerText();
      expect(noOriginChosenText).toEqual(frTranslations.noOriginChosen);
    }
    if (isNoDestinationChosenVisible) {
      const noDestinationChosenText = await this.noDestinationChosen.innerText();
      expect(noDestinationChosenText).toEqual(frTranslations.noDestinationChosen);
    }
  }

  // Perform pathfinding by entering origin, destination, and optionally via trigrams.
  async performPathfindingByTrigram({
    originTrigram,
    destinationTrigram,
    viaTrigram,
  }: {
    originTrigram: string;
    destinationTrigram: string;
    viaTrigram?: string;
  }): Promise<void> {
    await this.searchByTrigramButton.click();
    await expect(this.searchByTrigramContainer).toBeVisible();

    const inputTrigramText = viaTrigram
      ? `${originTrigram} ${viaTrigram} ${destinationTrigram}`
      : `${originTrigram} ${destinationTrigram}`;

    await this.searchByTrigramInput.fill(inputTrigramText);

    const originLocator = this.getOriginLocatorByTrigram(originTrigram);
    const destinationLocator = this.getDestinationLocatorByTrigram(destinationTrigram);

    await expect(originLocator).toBeVisible();
    await expect(destinationLocator).toBeVisible();

    if (viaTrigram) {
      const viaLocator = this.getViaLocatorByTrigram(viaTrigram);
      await expect(viaLocator).toBeVisible();
    }

    const expectedOriginTrigram = await originLocator.innerText();
    const expectedDestinationTrigram = await destinationLocator.innerText();

    await this.submitSearchByTrigram();
    await expect(this.pathfindingLoader).toBeHidden();
    await expect(this.searchByTrigramContainer).not.toBeVisible();
    await expect(this.resultPathfindingDone).toBeVisible();

    expect(await this.originInfo.innerText()).toEqual(expectedOriginTrigram);
    expect(await this.destinationInfo.innerText()).toEqual(expectedDestinationTrigram);
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
    const actualMessage = await this.missingParamMessage.innerText();
    expect(actualMessage).toContain(expectedMessage);
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

  // Validate the waypoint suggestions by checking the name, CH, UIC, and distance.
  private static async validateWaypointSuggestions(
    waypointSuggestion: Locator,
    expectedName: string,
    expectedCh: string,
    expectedUic: string,
    expectedKm: string
  ) {
    await expect(RouteTab.getWaypointSuggestionNameLocator(waypointSuggestion)).toHaveText(
      expectedName
    );
    await expect(RouteTab.getWaypointSuggestionChLocator(waypointSuggestion)).toHaveText(
      expectedCh
    );
    await expect(RouteTab.getWaypointSuggestionUicLocator(waypointSuggestion)).toHaveText(
      expectedUic
    );
    await expect(RouteTab.getWaypointSuggestionDistanceLocator(waypointSuggestion)).toHaveText(
      expectedKm
    );
  }

  // Validate the added waypoints by checking the name, CH, and UIC.
  static async validateAddedWaypoint(
    droppedWaypoint: Locator,
    expectedName: string,
    expectedCh: string,
    expectedUic: string
  ) {
    await expect(RouteTab.getWaypointDroppedNameLocator(droppedWaypoint)).toHaveText(expectedName);
    await expect(RouteTab.getWaypointDroppedChLocator(droppedWaypoint)).toHaveText(expectedCh);
    await expect(RouteTab.getWaypointDroppedUicLocator(droppedWaypoint)).toHaveText(expectedUic);
  }

  // Add new waypoints by clicking the add button for suggested waypoints and verifying the added waypoints.
  async addNewWaypoints(
    suggestedWaypointsCount: number,
    waypointToAddNames: string[],
    expectedValues: { name: string; ch: string; uic: string; km: string }[]
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
        expectedValue.ch,
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

      await RouteTab.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );

      droppedWaypointCount += 1;
    }
  }
}
export default RouteTab;
