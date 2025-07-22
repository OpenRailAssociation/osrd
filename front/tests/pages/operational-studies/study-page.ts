import { expect, type Locator, type Page } from '@playwright/test';

import type { StudyDetails } from '../../utils/types';
import CommonPage from '../common-page';

class StudyPage extends CommonPage {
  private readonly studyUpdateButton: Locator;

  private readonly studyName: Locator;

  private readonly studyDescription: Locator;

  private readonly studyState: Locator;

  private readonly studyType: Locator;

  private readonly studyServiceCodeInfo: Locator;

  private readonly studyBusinessCodeInfo: Locator;

  private readonly studyFinancialAmount: Locator;

  private readonly studyTags: Locator;

  private readonly addStudyButton: Locator;

  private readonly studyUpdateConfirmButton: Locator;

  private readonly studyInputName: Locator;

  private readonly studyTypeSelect: Locator;

  private readonly studyStatusSelect: Locator;

  private readonly studyDescriptionInput: Locator;

  private readonly studyStartDateInput: Locator;

  private readonly studyExpectedEndDateInput: Locator;

  private readonly studyEndDateInput: Locator;

  private readonly studyServiceCodeInput: Locator;

  private readonly studyBusinessCodeInput: Locator;

  private readonly studyBudgetInput: Locator;

  private readonly studyDeleteButton: Locator;

  private readonly createStudyButton: Locator;

  private readonly studyEditionModal: Locator;

  private readonly startDate: Locator;

  private readonly expectedEndDate: Locator;

  private readonly realEndDate: Locator;

  private readonly deleteScenarioButton: Locator;

  private readonly confirmDeleteScenarioButton: Locator;

  private readonly studyConfirmDeleteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.studyName = page.getByTestId('study-name-info');
    this.studyType = page.getByTestId('study-type');
    this.studyState = page.getByTestId('study-state-step-label');
    this.studyDescription = page.getByTestId('study-description');
    this.studyFinancialAmount = page.getByTestId('study-financial-amount');
    this.studyServiceCodeInfo = page.getByTestId('study-service-code-info');
    this.studyBusinessCodeInfo = page.getByTestId('study-business-code-info');
    this.studyTags = page.getByTestId('study-tags');
    this.addStudyButton = page.getByTestId('add-study-button');
    this.studyUpdateButton = page.getByTestId('study-modify-button');
    this.studyInputName = page.getByTestId('studyInputName-input');
    this.studyTypeSelect = page.getByTestId('select-toggle').first();
    this.studyStatusSelect = page.getByTestId('select-toggle').last();
    this.studyDescriptionInput = page.getByTestId('studyDescription-input');
    this.studyStartDateInput = page.getByTestId('studyInputStartDate-input');
    this.studyExpectedEndDateInput = page.getByTestId('studyInputExpectedEndDate-input');
    this.studyEndDateInput = page.getByTestId('studyInputRealEndDate-input');
    this.studyServiceCodeInput = page.getByTestId('studyInputServiceCode-input');
    this.studyBusinessCodeInput = page.getByTestId('studyInputBusinessCode-input');
    this.studyBudgetInput = page.getByTestId('studyInputBudget-input');
    this.studyUpdateConfirmButton = page.getByTestId('update-study');
    this.studyDeleteButton = page.getByTestId('delete-study');
    this.createStudyButton = page.getByTestId('create-study');
    this.studyEditionModal = page.getByTestId('study-edition-modal');
    this.startDate = page.getByTestId('study-start-date-value');
    this.expectedEndDate = page.getByTestId('study-expected-end-date-value');
    this.realEndDate = page.getByTestId('study-real-end-date-value');
    this.studyConfirmDeleteButton = page.getByTestId('confirm-delete-button');
    this.deleteScenarioButton = page.getByTestId('delete-scenario-button');
    this.confirmDeleteScenarioButton = page.getByTestId('confirm-delete-button');
  }

  getScenarioCardLocator(scenarioName: string): Locator {
    return this.page.getByTestId(`scenario-card-${scenarioName}`);
  }

  getScenarioTrainCount(scenarioName: string): Locator {
    return this.getScenarioCardLocator(scenarioName).getByTestId('scenario-trains-count');
  }

  // Fill the study details in the form inputs.
  private async fillStudyDetails(details: StudyDetails) {
    const {
      name,
      description,
      type,
      status,
      startDate,
      expectedEndDate,
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
    await this.studyExpectedEndDateInput.fill(expectedEndDate);
    await this.studyEndDateInput.fill(endDate);
    await this.studyServiceCodeInput.fill(serviceCode);
    await this.studyBusinessCodeInput.fill(businessCode);
    await this.studyBudgetInput.fill(budget);
    for (const tag of tags) await this.setTag(tag);
  }

  // Create a study based on the provided details.
  async createStudy(details: StudyDetails) {
    await expect(this.addStudyButton).toBeVisible();
    await this.addStudyButton.click();
    await this.fillStudyDetails(details);
    await this.createStudyButton.click();
    await this.page.waitForURL('**/studies/*');
  }

  // Update a study based on the provided details.
  async updateStudy(details: StudyDetails) {
    await this.studyUpdateButton.click();
    await this.fillStudyDetails(details);
    await this.studyUpdateConfirmButton.click();
    await this.page.waitForURL('**/studies/*');
  }

  // Validate that the study details match the expected values.
  async validateStudyData(details: StudyDetails & { isUpdate?: boolean }) {
    const {
      name,
      description,
      type,
      status,
      startDate,
      expectedEndDate,
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
    await expect(this.expectedEndDate).toHaveText(expectedEndDate);
    await expect(this.realEndDate).toHaveText(endDate);
    await expect(this.studyDescription).toHaveText(description);
    await expect(this.studyType).toHaveText(type);

    // Verify study state based on whether it's an update or a new creation.
    const stateLocator = isUpdate ? this.studyState.nth(1) : this.studyState.first();
    await expect(stateLocator).toHaveText(status);

    await expect(this.studyServiceCodeInfo).toHaveText(serviceCode);
    await expect(this.studyBusinessCodeInfo).toHaveText(businessCode);
    await this.validateNumericBudget(budget);
    expect(await this.studyTags.textContent()).toContain(tags.join(''));
  }

  getStudyByName(name: string) {
    return this.page.locator(`.study-card .study-card-name-text:has-text("${name}")`);
  }

  // Open a study by its test ID (The Test ID is the same as the Name).
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
    await this.page.locator('#select-toggle').getByText(status).click();
  }

  // Validate if the study's financial budget matches the expected value.
  async validateNumericBudget(expectedBudget: string) {
    const budgetText = await this.studyFinancialAmount.textContent();
    expect(budgetText?.replace(/[^0-9]/g, '')).toEqual(expectedBudget);
  }

  // Delete a study by its name.
  async deleteStudy(name: string) {
    await this.openStudyByTestId(name);
    await this.studyUpdateButton.click();
    await this.studyDeleteButton.click();
    await expect(this.studyDeleteButton).not.toBeVisible();
    await expect(this.studyConfirmDeleteButton).toBeVisible();
    await this.studyConfirmDeleteButton.click();
    await expect(this.studyConfirmDeleteButton).not.toBeVisible();
    await expect(this.getStudyByName(name)).not.toBeVisible();
  }

  async verifyScenarioTrainCount(scenarioName: string, expectedTrainCount: string) {
    await expect(this.getScenarioTrainCount(scenarioName)).toBeVisible();
    expect(await this.getScenarioTrainCount(scenarioName).innerText()).toEqual(expectedTrainCount);
  }

  async deleteScenario(scenarioName: string) {
    await this.getScenarioCardLocator(scenarioName).click();
    await this.deleteScenarioButton.click();
    await this.confirmDeleteScenarioButton.click();
    await expect(this.getScenarioCardLocator(scenarioName)).not.toBeVisible();
  }
}
export default StudyPage;
