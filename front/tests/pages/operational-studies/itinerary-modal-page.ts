import { expect, type Locator, type Page } from '@playwright/test';

import { expectFieldsToHaveValues, handleAndVerifyInput, selectAndCheckOption } from '../../utils';

class ItineraryModalPage {
  private readonly itineraryModal: Locator;
  private readonly itineraryModalTab: Locator;
  private readonly itineraryModalFormHeader: Locator;
  private readonly itineraryModalFormBody: Locator;
  private readonly itineraryModalFormFooter: Locator;
  private readonly rocketSearch: Locator;
  private readonly itineraryModalMap: Locator;
  private readonly itineraryModalCancelButton: Locator;
  private readonly itineraryModalAddSingleTrainButton: Locator;
  private readonly itineraryModalAddServiceTrainButton: Locator;
  private readonly itineraryModalEditTrainButton: Locator;
  private readonly comboBox: Locator;
  private readonly pathStepWrapper: Locator;
  private readonly opSuggestion: Locator;
  private readonly pathStepGap: Locator;
  private readonly addPathStepButton: Locator;
  private readonly pathStepCounter: Locator;
  private readonly trailingPlaceholder: Locator;
  private readonly trailingPlaceholderCombobox: Locator;
  readonly rollingStockSelector: Locator;
  readonly categorySelector: Locator;
  readonly compositionCodeInput: Locator;
  readonly trainNameInput: Locator;
  private readonly launchRocketSearchButton: Locator;
  private readonly rollingStockFirstSuggestion: Locator;
  private readonly pathStepMarker: Locator;
  private readonly itineraryReverseButton: Locator;
  private readonly trackNameSelector: Locator;
  private readonly segmentedControlInputPass: Locator;
  private readonly segmentedControlInputStop: Locator;
  private readonly timetableItem: Locator;
  private readonly timetableItemName: Locator;
  private readonly collapsedTrainHeader: Locator;
  private readonly timestopsTrainCategory: Locator;
  private readonly timestopsTrainRollingStockName: Locator;
  private readonly timestopsTrainCompositionCode: Locator;
  private readonly waypointName: Locator;
  private readonly infoBannerText: Locator;
  private readonly errorBannerText: Locator;
  private readonly warningBannerText: Locator;
  private readonly trainNameRequiredField: Locator;
  private readonly invalidReason: Locator;
  private readonly invalidPathStepMessage: Locator;
  private readonly editTrainButton: Locator;

  constructor(page: Page) {
    this.itineraryModal = page.getByTestId('itinerary-modal');
    this.itineraryModalTab = page.getByTestId('itinerary-modal-form');
    this.itineraryModalFormHeader = page.getByTestId('itinerary-modal-form-header');
    this.itineraryModalFormBody = page.getByTestId('itinerary-modal-form-body');
    this.itineraryModalFormFooter = page.getByTestId('itinerary-modal-form-footer');
    this.rocketSearch = page.getByTestId('type-and-path-input');
    this.itineraryModalMap = page.getByTestId('itinerary-modal-map');
    this.itineraryModalCancelButton = page.getByTestId('close-itinerary-modal');
    this.itineraryModalAddSingleTrainButton = page.getByTestId(
      'itinerary-modal-add-single-train-button'
    );
    this.itineraryModalAddServiceTrainButton = page.getByTestId(
      'itinerary-modal-add-service-train-button'
    );
    this.itineraryModalEditTrainButton = page.getByTestId('itinerary-modal-edit-train-button');
    this.comboBox = page.getByTestId('path-step-combo-box');
    this.pathStepWrapper = page.getByTestId('path-step-wrapper');
    this.opSuggestion = page.getByTestId('op-suggestion');
    this.pathStepGap = page.getByTestId('path-step-gap');
    this.addPathStepButton = page.getByTestId('add-path-step-button');
    this.pathStepCounter = page.getByTestId('path-step-counter');
    this.trailingPlaceholder = page.getByTestId('trailing-placeholder');
    this.trailingPlaceholderCombobox = this.trailingPlaceholder.getByTestId('path-step-combo-box');
    this.rollingStockSelector = page.getByTestId('itinerary-modal-rolling-stock');
    this.categorySelector = page.getByTestId('itinerary-modal-category');
    this.compositionCodeInput = page.getByTestId('itinerary-modal-composition-code');
    this.trainNameInput = page.getByTestId('itinerary-modal-train-name');
    this.launchRocketSearchButton = page.getByTestId('submit-search-by-main-code');
    this.rollingStockFirstSuggestion = page.getByTestId('rolling-stock-combobox-item').first();
    this.pathStepMarker = page.getByTestId('path-step-marker');
    this.itineraryReverseButton = page.getByTestId('reverse-itinerary-button');
    this.trackNameSelector = page.getByTestId('track-name');
    this.segmentedControlInputPass = page.getByTestId('segmented-control-pass');
    this.segmentedControlInputStop = page.getByTestId('segmented-control-stop');
    this.timetableItem = page.getByTestId('scenario-train-schedule');
    // Unique trains use 'train-name', paced trains use 'paced-train-name'.
    this.timetableItemName = this.timetableItem.getByTestId(/^(train-name|paced-train-name)$/);
    this.collapsedTrainHeader = page.getByTestId('train-header-collapsed');
    this.timestopsTrainCategory = page.getByTestId('train-category');
    this.timestopsTrainRollingStockName = page.getByTestId('train-rolling-stock');
    this.timestopsTrainCompositionCode = page.getByTestId('train-composition-code');
    this.waypointName = page.getByTestId('waypoint-name');
    this.editTrainButton = page.getByTestId('edit-train');
    this.warningBannerText = page.getByTestId('banner-text-warning');
    this.infoBannerText = page.getByTestId('banner-text-info');
    this.errorBannerText = page.getByTestId('banner-text-error');
    this.trainNameRequiredField = page.getByTestId('status-message-error');
    this.invalidReason = page.getByTestId('invalid-reason');
    this.pathStepWrapper = page.getByTestId('path-step-wrapper');
    this.invalidPathStepMessage = page.getByTestId('invalid-step-message');
  }

  private getOpNameClearIcon(pathStepIndex: number): Locator {
    return this.pathStepWrapper
      .nth(pathStepIndex)
      .getByTestId('path-step-op-name')
      .getByTestId('clear-icon');
  }

  async checkCategory(value: string) {
    await expectFieldsToHaveValues([[this.categorySelector, value]]);
  }

  async selectAndCheckCategory(value: string) {
    await selectAndCheckOption(this.categorySelector, value);
  }

  async selectAndCheckCompositionCode(value: string) {
    await selectAndCheckOption(this.compositionCodeInput, value);
  }

  async fillTrainName(value: string) {
    await expect(this.trainNameInput).toBeVisible();
    await this.trainNameInput.fill(value);
  }

  async fillAndCheckTrainName(value: string) {
    await handleAndVerifyInput(this.trainNameInput, value);
  }

  async checkRollingStock(value: string) {
    await expectFieldsToHaveValues([[this.rollingStockSelector, value]]);
  }

  async checkItineraryModalDefaultState(mode: 'create' | 'edit' = 'create') {
    await expect(this.itineraryModalFormHeader).toBeVisible();
    await expect(this.itineraryModalFormBody).toBeVisible();
    await expect(this.itineraryModalFormFooter).toBeVisible();
    await expect(this.itineraryModalMap).toBeVisible();
    await expect(this.itineraryModalCancelButton).toBeVisible();
    if (mode === 'create') {
      await expect(this.itineraryModalAddSingleTrainButton).toBeVisible();
      await expect(this.itineraryModalAddServiceTrainButton).toBeVisible();
      await expect(this.itineraryModalEditTrainButton).not.toBeVisible();
    } else {
      await expect(this.itineraryModalEditTrainButton).toBeVisible();
      await expect(this.itineraryModalAddSingleTrainButton).not.toBeVisible();
      await expect(this.itineraryModalAddServiceTrainButton).not.toBeVisible();
    }
  }

  async checkItineraryModalEmptyHeader(expectedText: string) {
    await expectFieldsToHaveValues([
      [this.categorySelector, expectedText],
      [this.rollingStockSelector, ''],
      [this.compositionCodeInput, expectedText],
      [this.trainNameInput, ''],
    ]);
  }

  async checkItineraryModalHeader(
    category: string,
    rollingStock: string,
    compositionCode: string,
    trainName: string
  ) {
    await expectFieldsToHaveValues([
      [this.categorySelector, category],
      [this.rollingStockSelector, rollingStock],
      [this.compositionCodeInput, compositionCode],
      [this.trainNameInput, trainName],
    ]);
  }

  async checkItineraryModalEmptyRocket() {
    await expect(this.rocketSearch).toBeVisible();
    await expect(this.rocketSearch).toHaveValue('');
  }

  async checkItineraryModalDefaultRowContent() {
    await expect(this.comboBox).toBeVisible();
    await expect(this.comboBox).toHaveValue('');
    await expect(this.comboBox).toHaveCount(1);
  }

  // When using the modal for the first time, only one empty pathStepItem is rendered.
  // We can either add a previous empty one by clicking the add pathstep above the first item,
  // either filling the first pathstepItem to create a new pathStepItem below it.

  async fillFirstPathStep(searchValue: string, expectedComboBoxCount: number) {
    await this.comboBox.click();
    await this.comboBox.fill(searchValue);
    await expect(this.opSuggestion.first()).toBeVisible();
    await this.comboBox.press('Enter');
    await expect(this.comboBox).toHaveCount(expectedComboBoxCount);
  }

  async fillLastPathStep(
    searchValue: string,
    expectedComboBoxCount: number,
    expectedSuggestion: string
  ) {
    await this.comboBox.last().click();
    await this.comboBox.last().fill(searchValue);
    await expect(this.opSuggestion.first()).toBeVisible();
    await expect(this.opSuggestion.first()).toHaveText(expectedSuggestion);
    await this.comboBox.last().press('Enter');
    await expect(this.comboBox).toHaveCount(expectedComboBoxCount);
  }

  async addEmptyIntermediateRow(gapIndex: number, expectedComboBoxCount: number) {
    await this.pathStepGap.nth(gapIndex).hover();
    await expect(this.addPathStepButton).toBeVisible();
    await this.addPathStepButton.click();
    await expect(this.comboBox).toHaveCount(expectedComboBoxCount);
  }

  async checkTrailingPlaceholder() {
    await expect(this.trailingPlaceholderCombobox).toBeVisible();
    await expect(this.trailingPlaceholderCombobox).toHaveValue('');
  }

  async deleteNumberedRow(counterIndex: number, expectedComboBoxCount: number) {
    await this.pathStepCounter.nth(counterIndex).click();
    await expect(this.comboBox).toHaveCount(expectedComboBoxCount);
  }

  async clearPathStepValue(pathStepIndex: number) {
    const expectedComboBoxCount = await this.comboBox.count();
    await this.getOpNameClearIcon(pathStepIndex).click();
    await expect(this.comboBox).toHaveCount(expectedComboBoxCount);
    await expect(this.comboBox.nth(pathStepIndex)).toHaveValue('');
  }

  async checkPathStepCounterText(index: number, expectedText: string) {
    await expect(this.pathStepCounter.nth(index)).toHaveText(expectedText);
  }

  async checkNumberedRowsCount(count: number) {
    await expect(this.comboBox).toHaveCount(count);
  }

  async fillRollingStock(rollingStockQuery: string) {
    await this.rollingStockSelector.click();
    await this.rollingStockSelector.fill(rollingStockQuery);
    await expect(this.rollingStockFirstSuggestion).toBeVisible();
    await this.rollingStockFirstSuggestion.click();
  }

  async launchRocketSearch(mainCode: string) {
    await this.rocketSearch.click();
    await this.rocketSearch.fill(mainCode);
    await expect(this.launchRocketSearchButton).toBeVisible();
    await expect(this.launchRocketSearchButton).toBeEnabled();
    await this.launchRocketSearchButton.click();
  }

  async checkRowsCreationAfterRocketSearch(firstStepValue: string, secondStepValue: string) {
    await expect(this.comboBox).toHaveCount(3);
    await expect(this.comboBox.first()).toHaveValue(firstStepValue);
    await expect(this.comboBox.nth(1)).toHaveValue(secondStepValue);
    await expect(this.comboBox.nth(2)).toHaveValue('');
    await expect(this.pathStepCounter.nth(2)).toHaveText('');
  }

  async checkPathStepMarkers(markers: { name: string; index: number }[]) {
    await expect(this.itineraryModalMap).toBeVisible();
    await expect(this.pathStepMarker).toHaveCount(markers.length);
    for (const marker of markers) {
      const expectedText = `${marker.index}${marker.name}`;
      await expect(this.pathStepMarker.filter({ hasText: expectedText })).toHaveCount(1);
    }
  }

  async reverseItinerary() {
    await expect(this.itineraryReverseButton).toBeVisible();
    await this.itineraryReverseButton.click();
  }

  async checkItineraryReverse(expectedFirstValue: string, expectedSecondValue: string) {
    await this.reverseItinerary();
    await expect(this.comboBox.first()).toHaveValue(expectedFirstValue);
    await expect(this.comboBox.nth(1)).toHaveValue(expectedSecondValue);
    await expect(this.pathStepCounter.nth(2)).toHaveText('');
  }

  async checkTrackSelectionAndStopsUpdate(
    trackNameIndex: number,
    trackName: string,
    withStopUpdated: boolean
  ) {
    const trackNameSelector = this.trackNameSelector.nth(trackNameIndex);
    const segmentedControlInputPass = this.segmentedControlInputPass.nth(trackNameIndex);
    const segmentedControlInputStop = this.segmentedControlInputStop.nth(trackNameIndex);

    await expect(trackNameSelector).toBeVisible();
    await trackNameSelector.click();
    await trackNameSelector.fill(trackName);
    await trackNameSelector.press('Enter');
    await expect(segmentedControlInputPass).toBeVisible();
    await expect(segmentedControlInputStop).toBeVisible();
    if (withStopUpdated) {
      await expect(segmentedControlInputPass).not.toBeChecked();
      await expect(segmentedControlInputStop).toBeChecked();
      await segmentedControlInputPass.click();
      await expect(segmentedControlInputPass).toBeChecked();
      await expect(segmentedControlInputStop).not.toBeChecked();
    } else {
      await expect(segmentedControlInputPass).toBeChecked();
      await expect(segmentedControlInputStop).not.toBeChecked();
      await segmentedControlInputStop.click();
      await expect(segmentedControlInputStop).toBeChecked();
      await expect(segmentedControlInputPass).not.toBeChecked();
    }
  }

  async createTrain() {
    await expect(this.itineraryModalAddSingleTrainButton).toBeVisible();
    await this.itineraryModalAddSingleTrainButton.click();
    await expect(this.itineraryModal).not.toBeVisible();
  }

  async createServiceTrain() {
    await expect(this.itineraryModalAddServiceTrainButton).toBeVisible();
    await this.itineraryModalAddServiceTrainButton.click();
    await expect(this.itineraryModal).not.toBeVisible();
  }

  async submitEdit() {
    await expect(this.itineraryModalEditTrainButton).toBeVisible();
    await this.itineraryModalEditTrainButton.click();
    await expect(this.itineraryModal).not.toBeVisible();
  }

  async checkTrainPresenceInTimetable(name: string) {
    await expect(this.timetableItem).toBeVisible();
    await expect(this.timetableItemName).toBeVisible();
    await expect(this.timetableItemName).toHaveText(name);
  }

  async verifyTrainColorInTimetable(color: string) {
    await expect(this.timetableItemName).toHaveCSS('color', color);
  }
  async checkTrainHeaderDetails(category: string, rollingStock: string, compositionCode: string) {
    await expect(this.collapsedTrainHeader).toBeVisible();
    await expect(this.timestopsTrainCategory).toHaveText(category);
    await expect(this.timestopsTrainRollingStockName).toHaveText(rollingStock);
    await expect(this.timestopsTrainCompositionCode).toHaveText(compositionCode);
  }

  async checkManchetteOriginAndDestination(origin: string, destination: string) {
    await expect(this.waypointName.first()).toBeVisible();
    await expect(this.waypointName.first()).toHaveText(origin);
    await expect(this.waypointName.last()).toBeVisible();
    await expect(this.waypointName.last()).toHaveText(destination);
  }

  async fillPathStepByName(index: number, searchValue: string, expectedSuggestionText: string) {
    await this.comboBox.nth(index).click();
    await this.comboBox.nth(index).fill(searchValue);
    await expect(this.opSuggestion.first()).toBeVisible();
    await expect(this.opSuggestion.first()).toHaveText(expectedSuggestionText);
  }

  async selectFirstOpSuggestion() {
    await this.opSuggestion.first().click();
  }

  async checkPathStepValue(position: number, expectedValue: string) {
    await expect(this.comboBox.nth(position)).toHaveValue(expectedValue);
  }

  async insertIntermediatePathStep(
    pathStepGapIndex: number,
    searchValue: string,
    comboboxIndex: number
  ) {
    await this.pathStepGap.nth(pathStepGapIndex).hover();
    await expect(this.addPathStepButton).toBeVisible();
    await this.addPathStepButton.click();
    await this.comboBox.nth(comboboxIndex).click();
    await this.comboBox.nth(comboboxIndex).fill(searchValue);
    await expect(this.opSuggestion.first()).toBeVisible();
    await this.opSuggestion.first().click();
  }

  async removePathStepAt(position: number) {
    await expect(this.pathStepCounter.nth(position)).toBeVisible();
    await this.pathStepCounter.nth(position).click();
  }

  async launchEditTrain() {
    await expect(this.timetableItem.first()).toBeVisible();
    await this.timetableItem.first().hover();
    await expect(this.editTrainButton.first()).toBeVisible();
    await this.editTrainButton.first().click();
    await expect(this.itineraryModalTab).toBeVisible();
  }

  async checkItineraryModalPrefilledRows(origin: string, destination: string) {
    await expect(this.comboBox.first()).toBeVisible();
    await expect(this.comboBox).toHaveCount(3);
    await expect(this.comboBox.first()).toHaveValue(origin);
    await expect(this.comboBox.nth(1)).toHaveValue(destination);
    await expect(this.comboBox.nth(2)).toHaveValue('');
  }

  async cancelItineraryEdition() {
    await expect(this.itineraryModalCancelButton).toBeVisible();
    await this.itineraryModalCancelButton.click();
    await expect(this.itineraryModalTab).not.toBeVisible();
  }

  async updateItineraryRows(trigram: string, comboboxValue: string) {
    await this.comboBox.first().click();
    await this.comboBox.first().fill(trigram);
    await expect(this.opSuggestion.first()).toBeVisible();
    await this.opSuggestion.first().click();
    await expect(this.comboBox.first()).toHaveValue(comboboxValue);
  }

  // Error handling

  async clickNextButton() {
    await expect(this.itineraryModalAddSingleTrainButton).toBeVisible();
    await this.itineraryModalAddSingleTrainButton.click();
  }

  async checkFormIsOpen() {
    await expect(this.itineraryModalFormHeader).toBeVisible();
    await expect(this.itineraryModalFormBody).toBeVisible();
  }

  async checkTrainNameRequiredError() {
    await expect(this.trainNameRequiredField).toBeVisible();
  }

  async checkMissingStepError(error: string) {
    await expect(this.errorBannerText).toBeVisible();
    await expect(this.errorBannerText).toBeVisible();
    await expect(this.errorBannerText).toHaveText(error);
  }

  async replacePathStepValueWithSuggestion(index: number, value: string) {
    await this.comboBox.nth(index).click();
    await this.comboBox.nth(index).fill('');
    await this.comboBox.nth(index).fill(value);
    await expect(this.opSuggestion.first()).toBeVisible();
    await this.comboBox.nth(index).press('Enter');
  }

  async replacePathStepValue(index: number, value: string) {
    await this.comboBox.nth(index).click();
    await this.comboBox.nth(index).fill('');
    await this.comboBox.nth(index).fill(value);
    await this.comboBox.nth(index).press('Enter');
  }

  async checkInvalidPathStep(index: number) {
    await expect(this.comboBox.nth(index)).toBeVisible();
    await expect(this.pathStepWrapper.nth(index)).toBeVisible();
    await expect(this.pathStepWrapper.nth(index)).toHaveClass(/is-invalid/);
  }

  async checkInvalidPathStepMessage(index: number, expectedMessage: string) {
    await expect(this.pathStepWrapper.nth(index)).toBeVisible();
    await expect(this.invalidPathStepMessage.nth(index)).toBeVisible();
    await expect(this.invalidPathStepMessage.nth(index)).toHaveText(expectedMessage);
  }

  async checkIncompatibleCategoryWarning(expectedMessage: string) {
    await expect(this.warningBannerText).toBeVisible();
    await expect(this.warningBannerText).toBeVisible();
    await expect(this.warningBannerText).toHaveText(expectedMessage);
  }

  async checkNoWarningBanner() {
    await expect(this.warningBannerText).not.toBeVisible();
  }

  async clearChValue(index: number, value: string) {
    await expect(this.comboBox.nth(index)).toBeVisible();
    await this.comboBox.nth(index).click();
    await this.comboBox.nth(index).fill(value);
    await expect(this.itineraryModalFormFooter).toBeVisible();
    await this.itineraryModalFormFooter.click();
  }

  async selectIncompatibleTrack(trackNameIndex: number, incompatibleTrackName: string) {
    const trackNameSelector = this.trackNameSelector.nth(trackNameIndex);
    await expect(trackNameSelector).toBeVisible();
    await trackNameSelector.click();
    await trackNameSelector.fill(incompatibleTrackName);
    await trackNameSelector.press('Enter');
  }

  async checkMapIncompatibilityDetails(expectedText: string) {
    await expect(this.infoBannerText).toBeVisible();
    await expect(this.infoBannerText).toHaveText(expectedText);
  }

  async checkInvalidReasonInTimetable(value: string) {
    await expect(this.invalidReason).toBeVisible();
    await expect(this.invalidReason).toHaveText(value);
  }
}
export default ItineraryModalPage;
