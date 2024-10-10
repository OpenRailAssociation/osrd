import { expect, type Locator, type Page } from '@playwright/test';

import enTranslations from '../../public/locales/en/operationalStudies/manageTrainSchedule.json';
import frTranslations from '../../public/locales/fr/operationalStudies/manageTrainSchedule.json';
import { clickWithDelay } from '../utils';

class RoutePage {
  readonly page: Page;

  readonly pathfindingNoState: Locator;

  readonly noOriginChosen: Locator;

  readonly noDestinationChosen: Locator;

  readonly searchByTrigramButton: Locator;

  readonly searchByTrigramContainer: Locator;

  readonly searchByTrigramInput: Locator;

  readonly searchByTrigramSubmit: Locator;

  readonly resultPathfindingDone: Locator;

  readonly originInfo: Locator;

  readonly destinationInfo: Locator;

  readonly viaInfo: Locator;

  readonly originDeleteButton: Locator;

  readonly destinationDeleteButton: Locator;

  readonly viaDeleteButton: Locator;

  readonly addWaypointsButton: Locator;

  readonly reverseItineraryButton: Locator;

  readonly deleteItineraryButton: Locator;

  readonly droppedWaypoints: Locator;

  readonly waypointSuggestions: Locator;

  readonly viaModal: Locator;

  readonly closeViaModalButton: Locator;

  readonly missingParamMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.pathfindingNoState = page.getByTestId('pathfinding-no-state');
    this.noOriginChosen = page.getByTestId('no-origin-chosen-text');
    this.noDestinationChosen = page.getByTestId('no-destination-chosen-text');
    this.searchByTrigramButton = page.getByTestId('rocket-button');
    this.searchByTrigramContainer = page.getByTestId('type-and-path-container');
    this.searchByTrigramInput = page.getByTestId('type-and-path-input');
    this.searchByTrigramSubmit = page.getByTestId('submit-search-by-trigram');
    this.resultPathfindingDone = page.getByTestId('result-pathfinding-done');
    this.originInfo = page.getByTestId('origin-op-info');
    this.destinationInfo = page.getByTestId('destination-op-info');
    this.viaInfo = page.getByTestId('via-op-info');
    this.originDeleteButton = page.getByTestId('delete-origin-button');
    this.destinationDeleteButton = page.getByTestId('delete-destination-button');
    this.viaDeleteButton = page.getByTestId('delete-via-button');
    this.addWaypointsButton = page.getByTestId('add-waypoints-button');
    this.reverseItineraryButton = page.getByTestId('reverse-itinerary-button');
    this.deleteItineraryButton = page.getByTestId('delete-itinerary-button');
    this.droppedWaypoints = page.getByTestId('dropped-via-info');
    this.waypointSuggestions = page.locator('.suggested-via-clickable');
    this.viaModal = page.locator('.manage-vias-modal');
    this.closeViaModalButton = page.getByLabel('Close');
    this.missingParamMessage = page.getByTestId('missing-params-info');
  }

  // Gets the name locator of a waypoint suggestion.
  static getWaypointSuggestionNameLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.locator('.suggested-via-name');
  }

  // Gets the CH locator of a waypoint suggestion.
  static getWaypointSuggestionChLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.locator('.suggested-via-ch');
  }

  // Gets the UIC locator of a waypoint suggestion.
  static getWaypointSuggestionUicLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.locator('.suggested-via-uic');
  }

  // Gets the distance locator of a waypoint suggestion.
  static getWaypointSuggestionDistanceLocator(waypointSuggestion: Locator): Locator {
    return waypointSuggestion.getByTestId('suggested-via-distance');
  }

  // Gets the name locator of a dropped waypoint.
  static getWaypointDroppedNameLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-name');
  }

  // Gets the CH locator of a dropped waypoint.
  static getWaypointDroppedChLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-ch');
  }

  // Gets the UIC locator of a dropped waypoint.
  static getWaypointDroppedUicLocator(droppedWaypoint: Locator): Locator {
    return droppedWaypoint.getByTestId('via-dropped-uic');
  }

  // Gets the locator of the origin by trigram.
  private getOriginLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
  }

  // Gets the locator of the destination by trigram.
  private getDestinationLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
  }

  // Gets the locator of the via by trigram.
  private getViaLocatorByTrigram(trigram: string): Locator {
    return this.page.getByTestId(`typeandpath-op-${trigram}`);
  }

  // Gets the add button locator by via name.
  private getAddButtonLocatorByViaName(viaName: string): Locator {
    return this.page.getByTitle(viaName).getByTestId('suggested-via-add-button');
  }

  // Gets the delete button locator by via name.
  private getDeleteButtonLocatorByViaName(viaName: string): Locator {
    return this.page.getByTitle(viaName).getByTestId('suggested-via-delete-button');
  }

  // Gets the pathfinding marker on the map by marker name.
  private getMapPathfindingMarker(markerName: string): Locator {
    return this.page.locator('#map-container').getByText(markerName, { exact: true });
  }

  // Clicks the button to submit the search by trigram.
  async clickSearchByTrigramSubmitButton() {
    await this.searchByTrigramSubmit.click();
  }

  // Clicks the button to delete the itinerary.
  async clickDeleteItineraryButton() {
    await this.deleteItineraryButton.click();
  }

  // Verifies that no route is selected and displays appropriate messages based on language.
  async verifyNoSelectedRoute(selectedLanguage: string) {
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    const isNoOriginChosenVisible = await this.noOriginChosen.isVisible();
    const isNoDestinationChosenVisible = await this.noDestinationChosen.isVisible();

    if (isNoOriginChosenVisible) {
      const noOriginChosenText = await this.noOriginChosen.innerText();
      expect(noOriginChosenText).toEqual(translations.noOriginChosen);
    }
    if (isNoDestinationChosenVisible) {
      const noDestinationChosenText = await this.noDestinationChosen.innerText();
      expect(noDestinationChosenText).toEqual(translations.noDestinationChosen);
    }
  }

  // Performs pathfinding by entering origin, destination, and optionally via trigrams.
  async performPathfindingByTrigram(
    originTrigram: string,
    destinationTrigram: string,
    viaTrigram?: string
  ) {
    await this.searchByTrigramButton.click();
    await expect(this.searchByTrigramContainer).toBeVisible();

    const inputTrigramText = viaTrigram
      ? `${originTrigram} ${viaTrigram} ${destinationTrigram}`
      : `${originTrigram} ${destinationTrigram}`;
    await this.searchByTrigramInput.fill(inputTrigramText);

    await expect(this.getOriginLocatorByTrigram(originTrigram)).toBeVisible();
    await expect(this.getDestinationLocatorByTrigram(destinationTrigram)).toBeVisible();
    if (viaTrigram) {
      await expect(this.getViaLocatorByTrigram(viaTrigram)).toBeVisible();
    }
    const expectedOriginTrigram = await this.getOriginLocatorByTrigram(originTrigram).innerText();
    const expectedDestinationTrigram =
      await this.getDestinationLocatorByTrigram(destinationTrigram).innerText();
    await this.clickSearchByTrigramSubmitButton();
    await this.page.waitForSelector('.dots-loader', { state: 'hidden' });
    await expect(this.searchByTrigramContainer).not.toBeVisible();
    await expect(this.resultPathfindingDone).toBeVisible();

    expect(await this.originInfo.innerText()).toEqual(expectedOriginTrigram);
    expect(await this.destinationInfo.innerText()).toEqual(expectedDestinationTrigram);
  }

  // Clicks the button to reverse the itinerary.
  async clickOnReverseItinerary() {
    await this.reverseItineraryButton.click();
  }

  // Clicks the buttons to delete origin, destination, and via waypoints and verifies missing parameters message.
  async clickOnDeleteOPButtons(selectedLanguage: string) {
    // Ensure all buttons are rendered and visible before proceeding
    await Promise.all([
      this.viaDeleteButton.waitFor({ state: 'visible' }),
      this.originDeleteButton.waitFor({ state: 'visible' }),
      this.destinationDeleteButton.waitFor({ state: 'visible' }),
    ]);

    // Click the buttons sequentially with waits to ensure UI stability
    await clickWithDelay(this.viaDeleteButton);
    await clickWithDelay(this.originDeleteButton);
    await clickWithDelay(this.destinationDeleteButton);
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    const expectedMessage = translations.pathfindingMissingParams.replace(
      ': {{missingElements}}.',
      ''
    );
    await this.missingParamMessage.waitFor({ state: 'visible' });
    const actualMessage = await this.missingParamMessage.innerText();
    expect(actualMessage).toContain(expectedMessage);
  }

  // Clicks the add buttons for the specified via names.
  async clickOnViaAddButtons(...viaNames: string[]) {
    for (const viaName of viaNames) {
      await clickWithDelay(this.getAddButtonLocatorByViaName(viaName));
      await expect(this.getDeleteButtonLocatorByViaName(viaName)).toBeVisible();
    }
  }

  // Verifies that the specified markers are visible on the map.
  async verifyMapMarkers(...markerNames: string[]) {
    for (const markerName of markerNames) {
      await expect(this.getMapPathfindingMarker(markerName)).toBeVisible();
    }
  }

  // Validates the waypoint suggestions by checking the name, CH, UIC, and distance.
  static async validateWaypointSuggestions(
    waypointSuggestion: Locator,
    expectedName: string,
    expectedCh: string,
    expectedUic: string,
    expectedKm: string
  ) {
    await expect(RoutePage.getWaypointSuggestionNameLocator(waypointSuggestion)).toHaveText(
      expectedName
    );
    await expect(RoutePage.getWaypointSuggestionChLocator(waypointSuggestion)).toHaveText(
      expectedCh
    );
    await expect(RoutePage.getWaypointSuggestionUicLocator(waypointSuggestion)).toHaveText(
      expectedUic
    );
    await expect(RoutePage.getWaypointSuggestionDistanceLocator(waypointSuggestion)).toHaveText(
      expectedKm
    );
  }

  // Validates the added waypoints by checking the name, CH, and UIC.
  static async validateAddedWaypoint(
    droppedWaypoint: Locator,
    expectedName: string,
    expectedCh: string,
    expectedUic: string
  ) {
    await expect(RoutePage.getWaypointDroppedNameLocator(droppedWaypoint)).toHaveText(expectedName);
    await expect(RoutePage.getWaypointDroppedChLocator(droppedWaypoint)).toHaveText(expectedCh);
    await expect(RoutePage.getWaypointDroppedUicLocator(droppedWaypoint)).toHaveText(expectedUic);
  }

  // Adds new waypoints by clicking the add button for suggested waypoints and verifying the added waypoints.
  async addNewWaypoints(
    suggestedWaypointsCount: number,
    waypointToAddNames: string[],
    expectedValues: { name: string; ch: string; uic: string; km: string }[]
  ) {
    await this.addWaypointsButton.click();
    await expect(this.viaModal).toBeVisible();
    await expect(this.waypointSuggestions).toHaveCount(suggestedWaypointsCount);

    let waypointSuggestionCount: number = 0;

    while (waypointSuggestionCount < expectedValues.length) {
      const waypointSuggestion = this.waypointSuggestions.nth(waypointSuggestionCount);
      const expectedValue = expectedValues[waypointSuggestionCount];

      await RoutePage.validateWaypointSuggestions(
        waypointSuggestion,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic,
        expectedValue.km
      );

      waypointSuggestionCount += 1;
    }

    await this.clickOnViaAddButtons(...waypointToAddNames);
    await this.closeViaModalButton.click();

    let droppedWaypointCount: number = 0;

    while (droppedWaypointCount < expectedValues.length) {
      const droppedWaypoint = this.droppedWaypoints.nth(droppedWaypointCount);
      const expectedValue = expectedValues[droppedWaypointCount];

      await RoutePage.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );

      droppedWaypointCount += 1;
    }
  }
}
export default RoutePage;
