import { expect, type Locator, type Page } from '@playwright/test';

import study from '../../public/locales/fr/operationalStudies/study.json';

class StudyPage {
  readonly page: Page;
  // Page information

  readonly getStudyUpdateBtn: Locator;

  readonly getStudyName: Locator;

  readonly getStudyDescription: Locator;

  readonly getStudyState: Locator;

  readonly getStudyType: Locator;

  readonly studyServiceCodeInfo: Locator;

  readonly studyBusinessCodeInfo: Locator;

  readonly getStudyFinancialsAmount: Locator;

  readonly getStudyTags: Locator;

  readonly getBackToProject: Locator;

  readonly translation: typeof study;

  readonly getAddStudyBtn: Locator;

  readonly getStudyUpdateConfirmBtn: Locator;

  readonly getStudyInputName: Locator;

  readonly getStudyTypeSelect: Locator;

  readonly getStudyStatusSelect: Locator;

  readonly getStudyDescriptionInput: Locator;

  readonly getStudyStartDateInput: Locator;

  readonly getStudyEstimatedEndDateInput: Locator;

  readonly getStudyEndDateInput: Locator;

  readonly getStudyServiceCodeInput: Locator;

  readonly getStudyBusinessCodeInput: Locator;

  readonly getStudyBudgetInput: Locator;

  readonly getStudyDeleteConfirmBtn: Locator;

  readonly createStudyButton: Locator;

  readonly studyEditionModal: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators using roles and text content
    this.getStudyName = page.getByTestId('study-name-info');
    this.getStudyType = page.locator('.study-details-type');
    this.getStudyState = page.getByTestId('study-state-step-label');
    this.getStudyDescription = page.locator('.study-details-description');
    this.getStudyFinancialsAmount = page.locator('.study-details-financials-amount');
    this.studyServiceCodeInfo = page.getByTestId('study-service-code-info');
    this.studyBusinessCodeInfo = page.getByTestId('study-business-code-info');
    this.getStudyTags = page.locator('.study-details-tags');
    this.getBackToProject = page.getByRole('heading', { name: 'Test e2e projet' });
    this.translation = study;
    this.getAddStudyBtn = page.getByTestId('add-study-button');
    this.getStudyUpdateBtn = page.getByTestId('study-modify-button');
    this.getStudyInputName = page.locator('#studyInputName');
    this.getStudyTypeSelect = page.locator('.input-group').first();
    this.getStudyStatusSelect = page.locator(
      '.study-edition-modal-state > div > .select-improved > .select-control > .input-group'
    );
    this.getStudyDescriptionInput = page.locator('#studyDescription');
    this.getStudyStartDateInput = page.getByLabel("Début de l'étude");
    this.getStudyEstimatedEndDateInput = page.getByLabel('Fin estimée');
    this.getStudyEndDateInput = page.getByLabel('Fin réalisée');
    this.getStudyServiceCodeInput = page.getByLabel('Code service');
    this.getStudyBusinessCodeInput = page.getByLabel('Code affaire');
    this.getStudyBudgetInput = page.getByLabel('Budget');
    this.getStudyUpdateConfirmBtn = page.locator('#modal-content').getByTestId('update-study');
    this.getStudyDeleteConfirmBtn = page.locator('#modal-content').getByTestId('delete-study');
    this.createStudyButton = page.getByTestId('create-study');
    this.studyEditionModal = page.getByTestId('study-edition-modal');
  }

  // Assert that the breadcrumb project link is displayed on the page
  async getDisplayLinks() {
    await expect(this.getBackToProject).toBeVisible();
  }

  getTranslations(key: keyof typeof study) {
    return this.translation[key];
  }

  getStudyByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  async openStudyModalUpdate() {
    await this.getStudyUpdateBtn.click();
  }

  async openStudyByTestId(studyTestId: string | RegExp) {
    await this.page.getByTestId(studyTestId).getByTestId('openStudy').first().click();
  }

  async openStudyCreationModal() {
    await this.getAddStudyBtn.click();
  }

  async setStudyName(name: string) {
    await this.getStudyInputName.fill(name);
  }

  async setStudyTypeByText(type: string) {
    await this.getStudyTypeSelect.click();
    await this.page.locator('#modal-body').getByText(type).click();
  }

  async setStudyStatusByText(status: string) {
    await this.getStudyStatusSelect.click();
    await this.page.locator('#-selecttoggle').getByText(status).click();
  }

  async setStudyDescription(description: string) {
    await this.getStudyDescriptionInput.fill(description);
  }

  async setStudyStartDate(date: string) {
    await this.getStudyStartDateInput.fill(date);
  }

  async setStudyEstimatedEndDate(date: string) {
    await this.getStudyEstimatedEndDateInput.fill(date);
  }

  async setStudyEndDate(date: string) {
    await this.getStudyEndDateInput.fill(date);
  }

  async setStudyServiceCode(code: string) {
    await this.getStudyServiceCodeInput.fill(code);
  }

  async setStudyBusinessCode(code: string) {
    await this.getStudyBusinessCodeInput.fill(code);
  }

  async setStudyBudget(code: string) {
    await this.getStudyBudgetInput.fill(code);
  }

  async clickStudyUpdateConfirmBtn() {
    await this.getStudyUpdateConfirmBtn.click();
  }

  async clickStudyDeleteConfirmBtn() {
    await this.getStudyDeleteConfirmBtn.click();
  }

  async getNumericFinancialsAmount() {
    const studyFinancialsDetails = await this.getStudyFinancialsAmount.textContent();
    return studyFinancialsDetails?.replace('Budget', '').replace(/\s+/g, ' ').trim();
  }
}
export default StudyPage;
