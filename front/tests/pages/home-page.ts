import { type BrowserContext, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page';

class HomePage extends CommonPage {
  private readonly operationalStudiesLink: Locator;

  private readonly cartoLink: Locator;

  private readonly editorLink: Locator;

  readonly linksTitle: Locator;

  private readonly rollingStockEditorLink: Locator;

  private readonly STDCMLink: Locator;

  private readonly backHomeLogo: Locator;

  private readonly dropDown: Locator;

  private readonly OSRDLanguage: Locator;

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
    this.OSRDLanguage = page.getByTestId('language-info');
  }

  async goToHomePage(): Promise<void> {
    await this.page.goto('/');
    await this.removeViteOverlay();
  }

  // Click on the logo to navigate back to the home page
  async backToHomePage(): Promise<void> {
    await this.backHomeLogo.click();
    await this.page.waitForLoadState();
  }

  async goToOperationalStudiesPage(): Promise<void> {
    await this.operationalStudiesLink.click();
  }

  async goToCartoPage(): Promise<void> {
    await this.cartoLink.click();
  }

  async goToEditorPage(): Promise<void> {
    await this.editorLink.click();
  }

  async goToRollingStockEditorPage(): Promise<void> {
    await this.rollingStockEditorLink.click();
  }

  async goToSTDCMPage(context: BrowserContext): Promise<Page> {
    // Wait for the new page to be created
    const [stdcmPage] = await Promise.all([context.waitForEvent('page'), this.STDCMLink.click()]);

    // Ensure the new page is fully loaded before proceeding
    await stdcmPage.waitForLoadState();

    return stdcmPage;
  }

  async getOSRDLanguage(): Promise<string> {
    await this.dropDown.click();
    const selectedLanguage = await this.OSRDLanguage.innerText();
    return selectedLanguage;
  }
}
export default HomePage;
