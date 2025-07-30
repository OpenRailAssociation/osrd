import { expect, type Locator, type Page } from '@playwright/test';

import DestinationSection from './destination-section';
import OriginSection from './origin-section';
import STDCMPage from './stdcm-page';
import LINKED_TRAIN_DETAILS from '../../assets/constants/linked-train-const';
import { DEFAULT_DETAILS } from '../../assets/constants/stdcm-const';

class LinkedTrainSection extends STDCMPage {
  readonly originPage: OriginSection;

  readonly destinationPage: DestinationSection;

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

  constructor(page: Page) {
    super(page);
    this.originPage = new OriginSection(page);
    this.destinationPage = new DestinationSection(page);

    this.anteriorDeleteLinkedPathButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-delete-button'
    );
    this.anteriorLinkedTrainField =
      this.anteriorLinkedTrainContainer.getByTestId('linked-train-id-input');
    this.anteriorLinkedTrainDate =
      this.anteriorLinkedTrainContainer.getByTestId('linked-train-date-input');
    this.anteriorLinkedTrainSearchButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-search-button'
    );
    this.posteriorDeleteLinkedPathButton = this.posteriorLinkedTrainContainer.getByTestId(
      'linked-train-delete-button'
    );
    this.posteriorLinkedTrainField =
      this.posteriorLinkedTrainContainer.getByTestId('linked-train-id-input');
    this.posteriorLinkedTrainDate =
      this.posteriorLinkedTrainContainer.getByTestId('linked-train-date-input');
    this.posteriorLinkedTrainSearchButton = this.posteriorLinkedTrainContainer.getByTestId(
      'linked-train-search-button'
    );
    this.anteriorLinkedTrainResultInfosButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-result-infos'
    );
    this.posteriorLinkedTrainResultInfosButton = this.posteriorLinkedTrainContainer.getByTestId(
      'linked-train-result-infos'
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
  private async getLinkedTrainDetails(isAnterior: boolean = false) {
    const trainResultInfosButton = isAnterior
      ? this.posteriorLinkedTrainResultInfosButton
      : this.anteriorLinkedTrainResultInfosButton;
    await expect(trainResultInfosButton).toBeVisible();

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
    await expect(this.originPage.dynamicOriginCi).toHaveValue(dynamicOriginCi);
    await expect(this.originPage.dynamicOriginCh).toHaveValue(dynamicOriginCh);
    await expect(this.originPage.originArrival).toHaveValue(originArrival);
    await expect(this.originPage.dateOriginArrival).toHaveValue(dateOriginArrival);
    await expect(this.originPage.timeOriginArrival).toHaveValue(timeOriginArrival);
    await expect(this.originPage.toleranceOriginArrival).toHaveValue(toleranceOriginArrival);
    await this.fillToleranceField({
      toleranceInput: this.originPage.toleranceOriginArrival,
      minusValue: toleranceFields.min,
      plusValue: toleranceFields.max,
      toleranceOp: 'origin',
    });
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
    await expect(this.destinationPage.dynamicDestinationCi).toHaveValue(dynamicDestinationCi);
    await expect(this.destinationPage.dynamicDestinationCh).toHaveValue(dynamicDestinationCh);
    await expect(this.destinationPage.destinationArrival).toHaveValue(destinationArrival);
    await expect(this.destinationPage.dateDestinationArrival).toHaveValue(dateDestinationArrival);
    await expect(this.destinationPage.timeDestinationArrival).toHaveValue(timeDestinationArrival);
    await expect(this.destinationPage.toleranceDestinationArrival).toHaveValue(
      toleranceDestinationArrival
    );
    await this.fillToleranceField({
      toleranceInput: this.destinationPage.toleranceDestinationArrival,
      minusValue: toleranceFields.min,
      plusValue: toleranceFields.max,
      toleranceOp: 'destination',
    });
  }
}
export default LinkedTrainSection;
