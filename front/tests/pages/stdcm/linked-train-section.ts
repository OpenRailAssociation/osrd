import { expect, type Locator, type Page } from '@playwright/test';

import { expectFieldsToHaveValues } from '../../utils';
import type {
  AnteriorLinkedPathDetails,
  LinkedPathDefaultFields,
  LinkedTrainInfo,
  PosteriorLinkedPathDetails,
} from '../../utils/stdcm-types';
import DestinationSection from './destination-section';
import OriginSection from './origin-section';
import STDCMPage from './stdcm-page';

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

  async addAndDeleteDefaultLinkedPath({ defaultDate }: LinkedPathDefaultFields): Promise<void> {
    await this.anteriorAddLinkedPathButton.click();
    await expect(this.anteriorLinkedTrainField).toHaveValue('');
    await expect(this.anteriorLinkedTrainDate).toHaveValue(defaultDate);
    await expect(this.anteriorLinkedTrainSearchButton).toBeVisible();
    await this.anteriorDeleteLinkedPathButton.click();
    await expect(this.anteriorLinkedTrainField).toBeHidden();
    await expect(this.anteriorLinkedTrainDate).toBeHidden();
    await expect(this.anteriorLinkedTrainSearchButton).toBeHidden();

    await this.posteriorAddLinkedPathButton.click();
    await expect(this.posteriorLinkedTrainField).toHaveValue('');
    await expect(this.posteriorLinkedTrainDate).toHaveValue(defaultDate);
    await expect(this.posteriorLinkedTrainSearchButton).toBeVisible();
    await this.posteriorDeleteLinkedPathButton.click();
    await expect(this.posteriorLinkedTrainField).toBeHidden();
    await expect(this.posteriorLinkedTrainDate).toBeHidden();
    await expect(this.posteriorLinkedTrainSearchButton).toBeHidden();
  }

  private async getLinkedTrainDetails(isAnterior = true): Promise<LinkedTrainInfo[]> {
    const trainResultInfosButton = isAnterior
      ? this.anteriorLinkedTrainResultInfosButton
      : this.posteriorLinkedTrainResultInfosButton;

    await expect(trainResultInfosButton).toBeVisible();

    return trainResultInfosButton.evaluateAll((buttons) =>
      buttons.map((button) => {
        const trainName = button.querySelector('.train-name')?.textContent?.trim() ?? '';
        const segments = Array.from(button.querySelectorAll('.d-flex'), (segment) =>
          Array.from(
            segment.querySelectorAll('.opDetails'),
            (detail) => detail.textContent?.trim() ?? ''
          )
        );

        return { trainName, segments };
      })
    );
  }

  async anteriorLinkedPathDetails(details: AnteriorLinkedPathDetails): Promise<void> {
    const {
      trainName,
      trainDate,
      trainDetails,
      originCi,
      originCh,
      originArrival,
      dateOriginArrival,
      timeOriginArrival,
      toleranceOriginArrival,
      toleranceFields,
    } = details;

    await this.anteriorAddLinkedPathButton.click();
    await this.anteriorLinkedTrainField.fill(trainName);
    await this.anteriorLinkedTrainDate.fill(trainDate);
    await this.anteriorLinkedTrainSearchButton.click();
    await this.anteriorLinkedTrainResultInfosButton.click();

    const actualTrainDetails = await this.getLinkedTrainDetails(true);
    expect(actualTrainDetails).toEqual(trainDetails);

    await expectFieldsToHaveValues([
      [this.originPage.originCiField, originCi],
      [this.originPage.originSecondaryCodeField, originCh],
      [this.originPage.originArrival, originArrival],
      [this.originPage.dateOriginArrival, dateOriginArrival],
      [this.originPage.timeOriginArrival, timeOriginArrival],
      [this.originPage.toleranceOriginArrival, toleranceOriginArrival],
    ]);

    await this.fillToleranceField({
      toleranceInput: this.originPage.toleranceOriginArrival,
      minusValue: toleranceFields.min,
      plusValue: toleranceFields.max,
      toleranceOp: 'origin',
    });
  }

  async posteriorLinkedPathDetails(details: PosteriorLinkedPathDetails): Promise<void> {
    const {
      trainName,
      trainDate,
      trainDetails,
      destinationCi,
      destinationCh,
      destinationArrival,
      dateDestinationArrival,
      timeDestinationArrival,
      toleranceDestinationArrival,
      toleranceFields,
    } = details;

    await this.posteriorAddLinkedPathButton.click();
    await this.posteriorLinkedTrainField.fill(trainName);
    await this.posteriorLinkedTrainDate.fill(trainDate);
    await this.posteriorLinkedTrainSearchButton.click();
    await this.posteriorLinkedTrainResultInfosButton.click();

    const actualTrainDetails = await this.getLinkedTrainDetails(false);
    expect(actualTrainDetails).toEqual(trainDetails);

    await expectFieldsToHaveValues([
      [this.destinationPage.destinationCiField, destinationCi],
      [this.destinationPage.destinationSecondaryCodeField, destinationCh],
      [this.destinationPage.destinationArrival, destinationArrival],
      [this.destinationPage.dateDestinationArrival, dateDestinationArrival],
      [this.destinationPage.timeDestinationArrival, timeDestinationArrival],
      [this.destinationPage.toleranceDestinationArrival, toleranceDestinationArrival],
    ]);

    await this.fillToleranceField({
      toleranceInput: this.destinationPage.toleranceDestinationArrival,
      minusValue: toleranceFields.min,
      plusValue: toleranceFields.max,
      toleranceOp: 'destination',
    });
  }
}

export default LinkedTrainSection;
