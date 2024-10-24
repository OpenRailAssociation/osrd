import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';

// Define the type for study details
type StudyDetails = {
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  estimatedEndDate: string;
  endDate: string;
  serviceCode: string;
  businessCode: string;
  budget: string;
  tags: string[];
};

class StudyPage extends CommonPage {
  // Page Locators

  readonly studyUpdateButton: Locator;

  readonly studyName: Locator;

  readonly studyDescription: Locator;

  readonly studyState: Locator;

  readonly studyType: Locator;

  readonly studyServiceCodeInfo: Locator;

  readonly studyBusinessCodeInfo: Locator;

  readonly studyFinancialAmount: Locator;

  readonly studyTags: Locator;

  readonly addStudyButton: Locator;

  readonly studyUpdateConfirmButton: Locator;

  readonly studyInputName: Locator;

  readonly studyTypeSelect: Locator;

  readonly studyStatusSelect: Locator;

  readonly studyDescriptionInput: Locator;

  readonly studyStartDateInput: Locator;

  readonly studyEstimatedEndDateInput: Locator;

  readonly studyEndDateInput: Locator;

  readonly studyServiceCodeInput: Locator;

  readonly studyBusinessCodeInput: Locator;

  readonly studyBudgetInput: Locator;

  readonly studyDeleteConfirmButton: Locator;

  readonly createStudyButton: Locator;

  readonly studyEditionModal: Locator;

  readonly startDate: Locator;

  readonly estimatedEndDate: Locator;

  readonly realEndDate: Locator;

  constructor(page: Page) {
    super(page);
    // Page locators
    this.studyName = page.getByTestId('study-name-info');
    this.studyType = page.locator('.study-details-type');
    this.studyState = page.getByTestId('study-state-step-label');
    this.studyDescription = page.locator('.study-details-description');
    this.studyFinancialAmount = page.locator('.study-details-financials-amount');
    this.studyServiceCodeInfo = page.getByTestId('study-service-code-info');
    this.studyBusinessCodeInfo = page.getByTestId('study-business-code-info');
    this.studyTags = page.locator('.study-details-tags');
    this.addStudyButton = page.getByTestId('add-study-button');
    this.studyUpdateButton = page.getByTestId('study-modify-button');
    this.studyInputName = page.locator('#studyInputName');
    this.studyTypeSelect = page.locator('.input-group').first();
    this.studyStatusSelect = page.locator(
      '.study-edition-modal-state > div > .select-improved > .select-control > .input-group'
    );
    this.studyDescriptionInput = page.locator('#studyDescription');
    this.studyStartDateInput = page.locator('#studyInputStartDate');
    this.studyEstimatedEndDateInput = page.locator('#studyInputEstimatedEndDate');
    this.studyEndDateInput = page.locator('#studyInputRealEndDate');
    this.studyServiceCodeInput = page.locator('#studyInputServiceCode');
    this.studyBusinessCodeInput = page.locator('#studyInputBusinessCode');
    this.studyBudgetInput = page.locator('#studyInputBudget');
    this.studyUpdateConfirmButton = page.locator('#modal-content').getByTestId('update-study');
    this.studyDeleteConfirmButton = page.locator('#modal-content').getByTestId('delete-study');
    this.createStudyButton = page.getByTestId('create-study');
    this.studyEditionModal = page.getByTestId('study-edition-modal');
    this.startDate = page.locator(
      '.study-details-dates-date.start .study-details-dates-date-value'
    );
    this.estimatedEndDate = page.locator(
      '.study-details-dates-date.estimatedend .study-details-dates-date-value'
    );
    this.realEndDate = page.locator(
      '.study-details-dates-date.realend .study-details-dates-date-value'
    );
  }

  // Fills the study details in the form inputs.
  private async fillStudyDetails(details: StudyDetails) {
    const {
      name,
      description,
      type,
      status,
      startDate,
      estimatedEndDate,
      endDate,
      serviceCode,
      businessCode,
      budget,
      tags,
    } = details;
    await this.studyInputName.fill(name);
    await this.studyDescriptionInput.fill(description);
    await this.setStudyTypeByText(type);
    await this.setStudyStatusByText(status);
    await this.studyStartDateInput.fill(startDate);
    await this.studyEstimatedEndDateInput.fill(estimatedEndDate);
    await this.studyEndDateInput.fill(endDate);
    await this.studyServiceCodeInput.fill(serviceCode);
    await this.studyBusinessCodeInput.fill(businessCode);
    await this.studyBudgetInput.fill(budget);
    for (const tag of tags) await this.setTag(tag);
  }

  // Creates a study based on the provided details.
  async createStudy(details: StudyDetails) {
    await expect(this.addStudyButton).toBeVisible();
    await this.addStudyButton.click();
    await this.fillStudyDetails(details);
    await this.createStudyButton.click();
    await this.page.waitForURL('**/studies/*');
  }

  // Updates a study based on the provided details.
  async updateStudy(details: StudyDetails) {
    await this.studyUpdateButton.click();
    await this.fillStudyDetails(details);
    await this.studyUpdateConfirmButton.click();
    await this.page.waitForURL('**/studies/*');
  }

  // Validates that the study details match the expected values.
  async validateStudyData(details: StudyDetails & { isUpdate?: boolean }) {
    const {
      name,
      description,
      type,
      status,
      startDate,
      estimatedEndDate,
      endDate,
      serviceCode,
      businessCode,
      budget,
      tags,
      isUpdate = false,
    } = details;

    await expect(this.studyEditionModal).not.toBeVisible();
    await expect(this.studyName).toHaveText(name);
    await expect(this.startDate).toHaveText(startDate);
    await expect(this.estimatedEndDate).toHaveText(estimatedEndDate);
    await expect(this.realEndDate).toHaveText(endDate);
    await expect(this.studyDescription).toHaveText(description);
    await expect(this.studyType).toHaveText(type);

    // Verify study state based on whether it's an update or new creation
    const stateLocator = isUpdate ? this.studyState.nth(1) : this.studyState.first();
    await expect(stateLocator).toHaveText(status);

    await expect(this.studyServiceCodeInfo).toHaveText(serviceCode);
    await expect(this.studyBusinessCodeInfo).toHaveText(businessCode);
    await this.validateNumericBudget(budget);
    expect(await this.studyTags.textContent()).toContain(tags.join(''));
  }

  getStudyByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  // Opens a study by its test ID (The Test ID is the same as the Name).
  async openStudyByTestId(studyTestId: string | RegExp) {
    await this.page.getByTestId(studyTestId).first().hover();
    await this.page.getByTestId(studyTestId).getByTestId('openStudy').click();
  }

  async setStudyTypeByText(type: string) {
    await this.studyTypeSelect.click();
    await this.page.locator('#modal-body').getByText(type).click();
  }

  async setStudyStatusByText(status: string) {
    await this.studyStatusSelect.click();
    await this.page.locator('#-selecttoggle').getByText(status).click();
  }

  // Validates if the study's financial budget matches the expected value.
  async validateNumericBudget(expectedBudget: string) {
    const budgetText = await this.studyFinancialAmount.textContent();
    expect(budgetText?.replace(/[^0-9]/g, '')).toEqual(expectedBudget);
  }

  // Deletes a study by its name.
  async deleteStudy(name: string) {
    await this.openStudyByTestId(name);
    await this.studyUpdateButton.click();
    await this.studyDeleteConfirmButton.click();
    await expect(this.studyDeleteConfirmButton).not.toBeVisible();
    await expect(this.getStudyByName(name)).not.toBeVisible();
  }
}
export default StudyPage;
