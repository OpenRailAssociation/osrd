import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page-model';
import LINKED_TRAIN_DETAILS from '../assets/linked-train-const';
import { DEFAULT_DETAILS } from '../assets/stdcm-const';

class STDCMLinkedTrainPage extends STDCMPage {
  private readonly anteriorDeleteLinkedPathButton: Locator;

  private readonly anteriorLinkedTrainField: Locator;

  private readonly anteriorLinkedTrainDate: Locator;

  private readonly anteriorLinkedTrainSearchButton: Locator;

  private readonly anteriorLinkedTrainResultInfosButton: Locator;

  private readonly posteriorDeleteLinkedPathButton: Locator;

  private readonly posteriorLinkedTrainField: Locator;

  private readonly posteriorLinkedTrainDate: Locator;

  private readonly posteriorLinkedTrainSearchButton: Locator;

  private readonly posteriorLinkedTrainResultInfosButton: Locator;

  constructor(readonly page: Page) {
    super(page);
    this.anteriorDeleteLinkedPathButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-delete-button'
    );
    this.anteriorLinkedTrainField = this.anteriorLinkedTrainContainer.locator('#linked-train-id');
    this.anteriorLinkedTrainDate = this.anteriorLinkedTrainContainer.locator('#linked-train-date');
    this.anteriorLinkedTrainSearchButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-search-button'
    );
    this.posteriorDeleteLinkedPathButton = this.posteriorLinkedTrainContainer.getByTestId(
      'linked-train-delete-button'
    );
    this.posteriorLinkedTrainField = this.posteriorLinkedTrainContainer.locator('#linked-train-id');
    this.posteriorLinkedTrainDate =
      this.posteriorLinkedTrainContainer.locator('#linked-train-date');
    this.posteriorLinkedTrainSearchButton = this.posteriorLinkedTrainContainer.getByTestId(
      'linked-train-search-button'
    );
    this.anteriorLinkedTrainResultInfosButton = this.anteriorLinkedTrainContainer.locator(
      '.linked-train-result-infos'
    );
    this.posteriorLinkedTrainResultInfosButton = this.posteriorLinkedTrainContainer.locator(
      '.linked-train-result-infos'
    );
  }

  // Add an anterior and posterior linked path card, verify default fields, and delete it
  async addAndDeleteDefaultLinkedPath() {
    await this.anteriorAddLinkedPathButton.click();
    await expect(this.anteriorLinkedTrainField).toHaveValue('');
    await expect(this.anteriorLinkedTrainDate).toHaveValue(DEFAULT_DETAILS.arrivalDate);
    await expect(this.anteriorLinkedTrainSearchButton).toBeVisible();
    await this.anteriorDeleteLinkedPathButton.click();
    await expect(this.anteriorLinkedTrainField).not.toBeVisible();
    await expect(this.anteriorLinkedTrainDate).not.toBeVisible();
    await expect(this.anteriorLinkedTrainSearchButton).not.toBeVisible();
    await this.posteriorAddLinkedPathButton.click();
    await expect(this.posteriorLinkedTrainField).toHaveValue('');
    await expect(this.posteriorLinkedTrainDate).toHaveValue(DEFAULT_DETAILS.arrivalDate);
    await expect(this.posteriorLinkedTrainSearchButton).toBeVisible();
    await this.posteriorDeleteLinkedPathButton.click();
    await expect(this.posteriorLinkedTrainField).not.toBeVisible();
    await expect(this.posteriorLinkedTrainDate).not.toBeVisible();
    await expect(this.posteriorLinkedTrainSearchButton).not.toBeVisible();
  }

  // Get anterior or posterior searched linked train details
  async getLinkedTrainDetails(isAnterior: boolean = false) {
    const trainResultInfosButton = isAnterior
      ? this.posteriorLinkedTrainResultInfosButton
      : this.anteriorLinkedTrainResultInfosButton;
    await trainResultInfosButton.waitFor();

    // Extract and process train details
    return trainResultInfosButton.evaluateAll((buttons) =>
      buttons.map((button) => {
        const trainName = button.querySelector('.train-name')?.textContent?.trim() || '';
        const segments = Array.from(button.querySelectorAll('.d-flex'), (segment) =>
          Array.from(
            segment.querySelectorAll('.opDetails'),
            (detail) => detail.textContent?.trim() || ''
          )
        );
        return { trainName, segments };
      })
    );
  }

  // Add an anterior linked train and fill the path fields
  async anteriorLinkedPathDetails() {
    const {
      trainName,
      trainDate,
      trainDetails,
      dynamicOriginCi,
      dynamicOriginCh,
      originArrival,
      dateOriginArrival,
      timeOriginArrival,
      toleranceOriginArrival,
      toleranceFields,
    } = LINKED_TRAIN_DETAILS.anterior;
    await this.anteriorAddLinkedPathButton.click();
    await this.anteriorLinkedTrainField.fill(trainName);
    await this.anteriorLinkedTrainDate.fill(trainDate);
    await this.anteriorLinkedTrainSearchButton.click();
    await this.anteriorLinkedTrainResultInfosButton.click();
    const actualTrainDetails = await this.getLinkedTrainDetails();
    expect(actualTrainDetails).toEqual(trainDetails);
    await expect(this.dynamicOriginCi).toHaveValue(dynamicOriginCi);
    await expect(this.dynamicOriginCh).toHaveValue(dynamicOriginCh);
    await expect(this.originArrival).toHaveValue(originArrival);
    await expect(this.dateOriginArrival).toHaveValue(dateOriginArrival);
    await expect(this.timeOriginArrival).toHaveValue(timeOriginArrival);
    await expect(this.toleranceOriginArrival).toHaveValue(toleranceOriginArrival);
    await this.fillToleranceField(
      toleranceFields.min,
      toleranceFields.max,
      toleranceFields.isAnterior
    );
  }

  // Add an posterior linked train and fill the path fields
  async posteriorLinkedPathDetails() {
    const {
      trainName,
      trainDate,
      trainDetails,
      dynamicDestinationCi,
      dynamicDestinationCh,
      destinationArrival,
      dateDestinationArrival,
      timeDestinationArrival,
      toleranceDestinationArrival,
      toleranceFields,
    } = LINKED_TRAIN_DETAILS.posterior;
    await this.posteriorAddLinkedPathButton.click();
    await this.posteriorLinkedTrainField.fill(trainName);
    await this.posteriorLinkedTrainDate.fill(trainDate);
    await this.posteriorLinkedTrainSearchButton.click();
    await this.posteriorLinkedTrainResultInfosButton.click();
    const actualTrainDetails = await this.getLinkedTrainDetails(true);
    expect(actualTrainDetails).toEqual(trainDetails);
    await expect(this.dynamicDestinationCi).toHaveValue(dynamicDestinationCi);
    await expect(this.dynamicDestinationCh).toHaveValue(dynamicDestinationCh);
    await expect(this.destinationArrival).toHaveValue(destinationArrival);
    await expect(this.dateDestinationArrival).toHaveValue(dateDestinationArrival);
    await expect(this.timeDestinationArrival).toHaveValue(timeDestinationArrival);
    await expect(this.toleranceDestinationArrival).toHaveValue(toleranceDestinationArrival);
    await this.fillToleranceField(
      toleranceFields.min,
      toleranceFields.max,
      toleranceFields.isAnterior
    );
  }
}
export default STDCMLinkedTrainPage;
