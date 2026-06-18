import { expect, type Locator, type Page } from '@playwright/test';

class ItineraryModalPage {
  private readonly itineraryModalFormHeader: Locator;
  private readonly itineraryModalFormBody: Locator;
  private readonly itineraryModalFormFooter: Locator;
  private readonly rocketSearch: Locator;
  private readonly itineraryModalMap: Locator;
  private readonly itineraryModalCancelButton: Locator;
  private readonly itineraryModalNextButton: Locator;
  private readonly createTimetableItemButton: Locator;
  private readonly comboBox: Locator;
  private readonly opSuggestion: Locator;
  private readonly pathStepGap: Locator;
  private readonly addPathStepButton: Locator;
  private readonly pathStepCounter: Locator;
  private readonly trailingPlaceholder: Locator;
  private readonly trailingPlaceholderCombobox: Locator;
  private readonly rollingStockSelector: Locator;
  private readonly categorySelector: Locator;
  private readonly compositionCodeInput: Locator;
  private readonly trainNameInput: Locator;
  private readonly launchRocketSearchButton: Locator;
  private readonly rollingStockFirstSuggestion: Locator;
  private readonly pathStepMarker: Locator;
  private readonly itineraryReverseButton: Locator;
  private readonly trackNameSelector: Locator;
  private readonly segmentedControlInputPass: Locator;
  private readonly segmentedControlInputStop: Locator;
  private readonly timetableItem: Locator;
  private readonly timetableItemName: Locator;

  constructor(page: Page) {
    this.itineraryModalFormHeader = page.getByTestId('itinerary-modal-form-header');
    this.itineraryModalFormBody = page.getByTestId('itinerary-modal-form-body');
    this.itineraryModalFormFooter = page.getByTestId('itinerary-modal-form-footer');
    this.rocketSearch = page.getByTestId('type-and-path-input');
    this.itineraryModalMap = page.getByTestId('itinerary-modal-map');
    this.itineraryModalCancelButton = page.getByTestId('close-itinerary-modal');
    this.itineraryModalNextButton = page.getByTestId('itinerary-modal-next-button');
    this.createTimetableItemButton = page.getByTestId('create-train-schedule-button');
    this.comboBox = page.getByTestId('path-step-combo-box');
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
    this.timetableItemName = this.timetableItem.getByTestId('train-name');
  }

  async checkItineraryModalDefaultState() {
    await expect(this.itineraryModalFormHeader).toBeVisible();
    await expect(this.itineraryModalFormBody).toBeVisible();
    await expect(this.itineraryModalFormFooter).toBeVisible();
    await expect(this.itineraryModalMap).toBeVisible();
    await expect(this.itineraryModalCancelButton).toBeVisible();
    await expect(this.itineraryModalNextButton).toBeVisible();
  }

  async checkItineraryModalHeader(expectedText: string) {
    await expect(this.categorySelector).toBeVisible();
    await expect(this.categorySelector).toHaveValue(expectedText);
    await expect(this.rollingStockSelector).toBeVisible();
    await expect(this.rollingStockSelector).toHaveValue('');
    await expect(this.compositionCodeInput).toBeVisible();
    await expect(this.compositionCodeInput).toHaveValue(expectedText);
    await expect(this.trainNameInput).toBeVisible();
    await expect(this.trainNameInput).toHaveValue('');
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
}
export default ItineraryModalPage;
