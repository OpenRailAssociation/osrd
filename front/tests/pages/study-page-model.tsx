/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '@playwright/test';
import study from '../../public/locales/fr/operationalStudies/study.json';

export class StudyPage {
  // The current page object
  readonly page: Page;

  // Page informations
  readonly getStudyName: Locator;

  readonly getStudyDescription: Locator;

  readonly getStudyState: Locator;

  readonly getStudyType: Locator;

  readonly getStudyFinancialsInfos: Locator;

  readonly getStudyFinancialsAmount: Locator;

  readonly getStudyTags: Locator;

  // Locator for all links
  readonly getBackToProject: Locator;

  // Locator for the "back to home" logo
  readonly getBackHomeLogo: Locator;

  // Locator for the body
  readonly getBody: Locator;

  readonly translation: typeof study;

  readonly getViteOverlay: Locator;

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
    this.getBackHomeLogo = page.locator('.mastheader-logo');
    this.getBackToProject = page.getByRole('heading', { name: 'Test e2e projet' });
    this.getBody = page.locator('body');
    this.translation = study;
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
    expect(this.getBackToProject).toBeVisible();
  }

  getTranslations(key: keyof typeof study) {
    return this.translation[key];
  }

  async openStudyByTestId(studyTestId: string | RegExp) {
    await this.page
      .getByTestId(studyTestId)
      .getByRole('button', { name: 'Ouvrir' })
      .first()
      .click();
  }
}
