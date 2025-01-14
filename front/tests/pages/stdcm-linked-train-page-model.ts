import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page-model';
import LINKED_TRAIN_DETAILS from '../assets/linked-train-const';
import { DEFAULT_DETAILS } from '../assets/stdcm-const';

class STDCMLinkedTrainPage extends STDCMPage {
  readonly anteriorLinkedTrainContainer: Locator;

  readonly anteriorDeleteLinkedPathButton: Locator;

  readonly anteriorLinkedTrainField: Locator;

  readonly anteriorLinkedTrainDate: Locator;

  readonly anteriorLinkedTrainSearchButton: Locator;

  readonly posteriorLinkedTrainContainer: Locator;

  readonly posteriorDeleteLinkedPathButton: Locator;

  readonly posteriorLinkedTrainField: Locator;

  readonly posteriorLinkedTrainDate: Locator;

  readonly posteriorLinkedTrainSearchButton: Locator;

  constructor(readonly page: Page) {
    super(page);
    this.anteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.anterior-linked-train'
    );
    this.anteriorDeleteLinkedPathButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-delete-button'
    );
    this.anteriorLinkedTrainField = this.anteriorLinkedTrainContainer.locator('#linked-train-id');
    this.anteriorLinkedTrainDate = this.anteriorLinkedTrainContainer.locator('#linked-train-date');
    this.anteriorLinkedTrainSearchButton = this.anteriorLinkedTrainContainer.getByTestId(
      'linked-train-search-button'
    );
    this.posteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.posterior-linked-train'
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
}
export default STDCMLinkedTrainPage;
