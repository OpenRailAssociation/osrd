/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '../baseFixtures';
import study from '../../public/locales/fr/operationalStudies/study.json';

export class StudyPage {
  // The current page object
  readonly page: Page;

  // Page informations
  readonly getStudyUpdateBtn: Locator;

  readonly getStudyName: Locator;

  readonly getStudyDescription: Locator;

  readonly getStudyState: Locator;

  readonly getStudyType: Locator;

  readonly getStudyFinancialsInfos: Locator;

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

  constructor(page: Page) {
    this.page = page;
    // Initialize locators using roles and text content
    this.getStudyName = page.locator('.study-details-name .study-name');
    this.getStudyType = page.locator('.study-details-type');
    this.getStudyState = page.locator(
      '.study-details-state-step.done .study-details-state-step-label'
    );
    this.getStudyDescription = page.locator('.study-details-description');
    this.getStudyFinancialsAmount = page.locator('.study-details-financials-amount');
    this.getStudyFinancialsInfos = page.locator('.study-details-financials-infos-item .code');
    this.getStudyTags = page.locator('.study-details-tags');
    this.getBackToProject = page.getByRole('heading', { name: 'Test e2e projet' });
    this.translation = study;
    this.getAddStudyBtn = page.getByTestId('addStudy');
    this.getStudyUpdateBtn = page.locator('.study-details-modify-button');
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
    this.getStudyBusinessCodeInput = page.getByLabel('Code business');
    this.getStudyBudgetInput = page.getByLabel('Budget');
    this.getStudyUpdateConfirmBtn = page.locator('#modal-content').getByTestId('updateStudy');
    this.getStudyDeleteConfirmBtn = page.locator('#modal-content').getByTestId('deleteStudy');
  }

  // Assert that the breadcrumb project link is displayed on the page
  async getDisplayLinks() {
    expect(this.getBackToProject).toBeVisible();
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
}
