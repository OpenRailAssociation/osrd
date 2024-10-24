import { type BrowserContext, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';

class HomePage extends CommonPage {
  readonly operationalStudiesLink: Locator;

  readonly cartoLink: Locator;

  readonly editorLink: Locator;

  readonly rollingStockEditorLink: Locator;

  readonly STDCMLink: Locator;

  readonly linksTitle: Locator;

  readonly backHomeLogo: Locator;

  readonly dropDown: Locator;

  readonly userSettings: Locator;

  readonly OSRDLanguage: Locator;

  constructor(page: Page) {
    super(page);
    this.operationalStudiesLink = page.locator('a[href="/operational-studies/projects"]');
    this.STDCMLink = page.locator('a[href="/stdcm"]');
    this.editorLink = page.locator('a[href="/editor"]');
    this.rollingStockEditorLink = page.locator('a[href="/rolling-stock-editor"]');
    this.cartoLink = page.locator('a[href="/map"]');
    this.linksTitle = page.getByTestId('page-title');
    this.backHomeLogo = page.getByTestId('osrd-logo');
    this.dropDown = page.getByTestId('dropdown-sncf');
    this.userSettings = page.getByTestId('user-settings-btn');
    this.OSRDLanguage = page.getByTestId('language-info');
  }

  // Navigate to the Home page
  async goToHomePage() {
    await this.page.goto('/');
    await this.removeViteOverlay();
  }

  // Click on the logo to navigate back to the home page
  async backToHomePage() {
    await this.backHomeLogo.click();
  }

  async goToOperationalStudiesPage() {
    await this.operationalStudiesLink.click();
  }

  async goToCartoPage() {
    await this.cartoLink.click();
  }

  async goToEditorPage() {
    await this.editorLink.click();
  }

  async goToRollingStockEditorPage() {
    await this.rollingStockEditorLink.click();
  }

  async goToSTDCMPage(context: BrowserContext) {
    // Start waiting for the new page to be created
    const [stdcmPage] = await Promise.all([context.waitForEvent('page'), this.STDCMLink.click()]);

    // Ensure the new page is fully loaded before proceeding
    await stdcmPage.waitForLoadState();

    return stdcmPage;
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
