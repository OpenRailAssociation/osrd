import { expect, type Locator, type Page } from '@playwright/test';

import home from '../../public/locales/fr/home/home.json';

class HomePage {
  // The current page object
  readonly page: Page;

  // Locators for links
  readonly getOperationalStudiesLink: Locator;

  readonly getCartoLink: Locator;

  readonly getEditorLink: Locator;

  readonly getRollingStockEditorLink: Locator;

  readonly getSTDCMLink: Locator;

  // Locator for all links
  readonly getLinks: Locator;

  // Locator for the "back to home" logo
  readonly getBackHomeLogo: Locator;

  // Locator for the body
  readonly getBody: Locator;

  readonly translation: typeof home;

  readonly getViteOverlay: Locator;

  readonly dropDown: Locator;

  readonly userSettings: Locator;

  readonly OSRDLanguage: Locator;

  private stdcmSwitch: Locator;

  constructor(page: Page) {
    this.page = page;
    // Initialize locators using roles and text content
    this.getOperationalStudiesLink = page.getByRole('link', { name: /Études d'exploitation/ });
    this.getSTDCMLink = page.getByRole('link', { name: /Sillons de dernière minute/ });
    this.getEditorLink = page.getByRole('link', { name: /Éditeur d'infrastructure/ });
    this.getRollingStockEditorLink = page.getByRole('link', {
      name: /Éditeur de matériel roulant/,
    });
    this.getCartoLink = page.getByRole('link', { name: /Cartographie/ });
    this.getLinks = page.locator('h5');
    this.getBackHomeLogo = page.locator('.mastheader-logo');
    this.getBody = page.locator('body');
    this.translation = home;
    this.getViteOverlay = page.locator('vite-plugin-checker-error-overlay');
    this.stdcmSwitch = page.getByTestId('stdcm-version-switch');
    this.dropDown = page.getByTestId('dropdown-sncf');
    this.userSettings = page.getByTestId('user-settings-btn');
    this.OSRDLanguage = page.getByTestId('language-info');
  }

  // Completely remove VITE button & sign
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

  // Assert that the expected links are displayed on the page
  async getDisplayLinks() {
    expect(this.getLinks).toHaveText([
      this.getTranslations('operationalStudies'),
      this.getTranslations('stdcm'),
      this.getTranslations('editor'),
      this.getTranslations('rollingStockEditor'),
      this.getTranslations('map'),
    ]);
  }

  // Navigate to the different pages
  async goToOperationalStudiesPage() {
    await this.getOperationalStudiesLink.click();
  }

  async goToCartoPage() {
    await this.getCartoLink.click();
  }

  async goToEditorPage() {
    await this.getEditorLink.click();
  }

  async goToRollingStockEditorPage() {
    await this.getRollingStockEditorLink.click();
  }

  async goToSTDCMPage() {
    await this.getSTDCMLink.click();
  }

  getTranslations(key: keyof typeof home) {
    return this.translation[key];
  }

  // Check Stdcm Version
  async toggleStdcmV1() {
    await this.dropDown.click();
    await this.userSettings.click();
    if ((await this.stdcmSwitch.isChecked()) && (await this.stdcmSwitch.isVisible())) {
      await this.stdcmSwitch.click();
    }
  }

  // Get OSRD selected language
  async getOSRDLanguage(): Promise<string> {
    await this.dropDown.click();
    const selectedLanguage = await this.OSRDLanguage.innerText();
    await this.dropDown.click();
    return selectedLanguage;
  }
}
export default HomePage;
