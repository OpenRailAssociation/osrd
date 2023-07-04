/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '@playwright/test';
import project from '../../public/locales/fr/operationalStudies/project.json';

export class ProjectPage {
  // The current page object
  readonly page: Page;

  // Page informations
  readonly getProjectName: Locator;

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

  constructor(page: Page) {
    this.page = page;
    // Initialize locators using roles and text content
    this.getProjectName = page.locator('.project-details-title-name');
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
  }

  // Completly remove VITE button & panel
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

  async openProjectByTestId(projectTestId: string | RegExp) {
    await this.page
      .getByTestId(projectTestId)
      .getByRole('button', { name: 'Ouvrir' })
      .first()
      .click();
  }
}
