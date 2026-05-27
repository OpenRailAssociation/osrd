import { type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { HOME_URLS } from '../assets/constants/homepage-const';
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
    await this.page.goto(HOME_URLS.home);
  }

  async backToHomePage(): Promise<void> {
    await this.backHomeLogo.click();
    await this.page.waitForLoadState();
  }

  async goToOperationalStudiesPage(): Promise<void> {
    await this.operationalStudiesLink.click();
    await expect(this.page).toHaveURL(HOME_URLS.operationalStudies);
  }

  async goToCartoPage(): Promise<void> {
    await this.cartoLink.click();
    await expect(this.page).toHaveURL(HOME_URLS.map);
  }

  async goToEditorPage(): Promise<void> {
    await this.editorLink.click();
    await expect(this.page).toHaveURL(HOME_URLS.editor);
  }

  async goToRollingStockEditorPage(): Promise<void> {
    await this.rollingStockEditorLink.click();
    await expect(this.page).toHaveURL(HOME_URLS.rollingStockEditor);
  }

  async goToSTDCMPage(context: BrowserContext): Promise<Page> {
    const [stdcmPage] = await Promise.all([context.waitForEvent('page'), this.STDCMLink.click()]);
    await stdcmPage.waitForLoadState();
    await expect(stdcmPage).toHaveURL(HOME_URLS.stdcm);
    return stdcmPage;
  }

  async getOSRDLanguage(): Promise<string> {
    await this.dropDown.click();
    return this.OSRDLanguage.innerText();
  }
}

export default HomePage;
