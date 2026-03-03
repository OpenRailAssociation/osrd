import { expect, type Locator, type Page } from '@playwright/test';

import { STUDY_URLS } from '../../assets/operation-studies/study-const';
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

  private getStudyByName(name: string): Locator {
    return this.page.getByTestId(name);
  }
  private openStudyButton(name: string): Locator {
    return this.getStudyByName(name).getByTestId('openStudy');
  }

  private getScenarioCardLocator(scenarioName: string): Locator {
    return this.page.getByTestId(`scenario-card-${scenarioName}`);
  }

  private getScenarioTrainCount(scenarioName: string): Locator {
    return this.getScenarioCardLocator(scenarioName).getByTestId('scenario-trains-count');
  }

  private async openStudyByName(studyName: string) {
    await expect(this.getStudyByName(studyName)).toBeVisible();
    await this.getStudyByName(studyName).hover();
    await this.openStudyButton(studyName).click();
  }

  private async setStudyTypeByText(type: string) {
    await this.studyTypeSelect.click();
    await this.page.getByRole('button', { name: type }).click();
  }

  private async setStudyStatusByText(status: string) {
    await this.studyStatusSelect.click();
    const menu = this.page.getByRole('list');
    await menu.getByRole('button', { name: status, exact: true }).click();
  }

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

  async verifyStudyVisibility(studyName: string) {
    await expect(this.getStudyByName(studyName)).toBeVisible();
  }

  async createStudy(details: StudyDetails) {
    await expect(this.addStudyButton).toBeVisible();
    await this.addStudyButton.click();
    await this.fillStudyDetails(details);
    await this.createStudyButton.click();
    await this.page.waitForURL(STUDY_URLS.detail);
    await expect(this.studyEditionModal).not.toBeVisible();
  }

  async updateStudy(details: StudyDetails) {
    await this.studyUpdateButton.click();
    await this.fillStudyDetails(details);
    await this.studyUpdateConfirmButton.click();
    await this.page.waitForURL(STUDY_URLS.detail);
    await expect(this.studyEditionModal).not.toBeVisible();
  }

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
    await this.validateNumericBudget(this.studyFinancialAmount, budget);
    await expect(this.studyTags).toContainText(tags.join(''));
  }

  async deleteStudy(name: string) {
    await this.openStudyByName(name);
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
    await expect(this.getScenarioTrainCount(scenarioName)).toHaveText(expectedTrainCount);
  }

  async deleteScenario(scenarioName: string) {
    await this.getScenarioCardLocator(scenarioName).click();
    await this.deleteScenarioButton.click();
    await this.confirmDeleteScenarioButton.click();
    await expect(this.getScenarioCardLocator(scenarioName)).not.toBeVisible();
  }
}

export default StudyPage;
