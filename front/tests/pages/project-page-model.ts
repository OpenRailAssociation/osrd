/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '../baseFixtures';
import project from '../../public/locales/fr/operationalStudies/project.json';

export class ProjectPage {
  // The current page object
  readonly page: Page;

  // Page informations
  readonly getProjectName: Locator;

  readonly getProjectUpdateBtn: Locator;

  readonly getProjectDescription: Locator;

  readonly getProjectObjectives: Locator;

  readonly getProjectFinancialsInfos: Locator;

  readonly getProjectFinancialsAmount: Locator;

  readonly getProjectTags: Locator;

  // Locator for all links
  readonly getBackToProjects: Locator;

  // Locator for the "back to home" logo
  readonly getBackHomeLogo: Locator;

  // Locator for the body
  readonly getBody: Locator;

  readonly translation: typeof project;

  readonly getViteOverlay: Locator;

  readonly getAddProjectBtn: Locator;

  readonly getProjectNameInput: Locator;

  readonly getProjectDescriptionInput: Locator;

  readonly getProjectObjectiveInput: Locator;

  readonly getProjectFunderInput: Locator;

  readonly getProjectBudgetInput: Locator;

  readonly getProjectDeleteBtn: Locator;

  readonly getProjectUpdateConfirmBtn: Locator;

  readonly getProjectDeleteConfirmBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators using roles and text content
    this.getProjectName = page.locator('.project-details-title-name');
    this.getProjectUpdateBtn = page.locator('.project-details-title-modify-button');
    this.getProjectDescription = page.locator('.project-details-title-description');
    this.getProjectObjectives = page.locator('.project-details-title-objectives');
    this.getProjectFinancialsAmount = page.locator('.project-details-financials-amount');
    this.getProjectFinancialsInfos = page.locator('.project-details-financials-infos');
    this.getProjectTags = page.locator('.project-details-tags');
    this.getBackHomeLogo = page.locator('.mastheader-logo');
    this.getBackToProjects = page.getByRole('heading', { name: 'Projets' });
    this.getBody = page.locator('body');
    this.translation = project;
    this.getViteOverlay = page.locator('vite-plugin-checker-error-overlay');
    this.getAddProjectBtn = page.getByTestId('addProject');
    this.getProjectNameInput = page.locator('#projectInputName');
    this.getProjectDescriptionInput = page.locator('#projectDescription');
    this.getProjectObjectiveInput = page.locator('#projectObjectives');
    this.getProjectFunderInput = page.locator('#projectInputFunders');
    this.getProjectBudgetInput = page.locator('#projectInputBudget');
    this.getProjectDeleteBtn = page.getByTestId('deleteProjects');
    this.getProjectUpdateConfirmBtn = page.locator('#modal-content').getByTestId('updateProject');
    this.getProjectDeleteConfirmBtn = page.locator('#modal-content').getByTestId('deleteProject');
  }

  // Completly remove VITE button & sign
  async removeViteOverlay() {
    if ((await this.getViteOverlay.count()) > 0) {
      await this.getViteOverlay.evaluate((node) => node.setAttribute('style', 'display:none;'));
    }
  }

  // Navigate to the Home page
  async goToHomePage() {
    await this.page.goto('/');
    await this.removeViteOverlay();
  }

  // Click on the logo to navigate back to the home page
  async backToHomePage() {
    await this.getBackHomeLogo.click();
  }

  // Assert that the breadcrumb project link is displayed on the page
  async getDisplayLinks() {
    expect(this.getBackToProjects).toBeVisible();
  }

  getTranslations(key: keyof typeof project) {
    return this.translation[key];
  }

  async openProjectModalCreation() {
    await this.getAddProjectBtn.click();
  }

  async openProjectModalUpdate() {
    await this.getProjectUpdateBtn.click();
  }

  async openProjectByTestId(projectTestId: string | RegExp) {
    await this.page.getByTestId(projectTestId).getByTestId('openProject').first().click();
  }

  async setProjectName(name: string) {
    await this.getProjectNameInput.fill(name);
  }

  async setProjectDescription(description: string) {
    await this.getProjectDescriptionInput.fill(description);
  }

  async setProjectObjectives(objectives: string) {
    await this.getProjectObjectiveInput.fill(objectives);
  }

  async setProjectFunder(funder: string) {
    await this.getProjectFunderInput.fill(funder);
  }

  async setProjectBudget(budget: string) {
    await this.getProjectBudgetInput.fill(budget);
  }

  getProjectByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  async clickProjectByName(name: string) {
    await this.getProjectByName(name).first().click();
  }

  async clickProjectDeleteBtn() {
    await this.getProjectDeleteBtn.click();
  }

  async checkLabelProjectSelected() {
    expect(this.page.locator('.projects-selection-toolbar').locator('span').first());
  }

  async clickProjectUpdateConfirmBtn() {
    await this.getProjectUpdateConfirmBtn.click();
  }

  async clickProjectDeleteConfirmBtn() {
    await this.getProjectDeleteConfirmBtn.click();
  }
}
