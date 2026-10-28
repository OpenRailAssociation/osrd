import { type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { HOME_URLS } from '../assets/constants/homepage-const';
import CommonPage from './common-page';

class HomePage extends CommonPage {
  readonly linksTitle: Locator;
  private readonly backHomeLogo: Locator;
  private readonly dropDown: Locator;
  private readonly OSRDLanguage: Locator;
  private readonly userSettingsButton: Locator;
  private readonly impersonationInput: Locator;
  private readonly impersonationSuggestions: Locator;
  private readonly stopImpersonationButton: Locator;
  private readonly notAuthorizedWarning: Locator;
  readonly operationalStudiesTile: Locator;
  readonly infraEditorTile: Locator;
  readonly rollingStockEditorTile: Locator;
  readonly referenceMapTile: Locator;
  readonly stdcmTile: Locator;

  constructor(page: Page) {
    super(page);
    this.operationalStudiesTile = page.getByTestId('home-app-operational-studies');
    this.infraEditorTile = page.getByTestId('home-app-infra-editor');
    this.rollingStockEditorTile = page.getByTestId('home-app-rolling-stock-editor');
    this.referenceMapTile = page.getByTestId('home-app-reference-map');
    this.stdcmTile = page.getByTestId('home-app-stdcm');
    this.linksTitle = page.getByTestId('page-title');
    this.backHomeLogo = page.getByTestId('osrd-logo');
    this.dropDown = page.getByTestId('dropdown-sncf');
    this.OSRDLanguage = page.getByTestId('language-info');
    this.userSettingsButton = page.getByTestId('user-settings-btn');
    this.impersonationInput = page.getByTestId('impersonation-input');
    this.impersonationSuggestions = page.getByTestId('impersonation-item');
    this.stopImpersonationButton = page.getByTestId('stop-impersonation-btn');
    this.notAuthorizedWarning = page.getByTestId('not-authorized-warning');
  }

  get appTiles(): Locator[] {
    return [
      this.operationalStudiesTile,
      this.infraEditorTile,
      this.rollingStockEditorTile,
      this.referenceMapTile,
      this.stdcmTile,
    ];
  }

  async impersonateUser(name: string): Promise<void> {
    await this.goToHomePage();
    await this.dropDown.click();
    await this.userSettingsButton.click();
    await this.impersonationInput.fill(name);
    await this.impersonationSuggestions.filter({ hasText: name }).click();
    await expect(this.stopImpersonationButton).toBeVisible();
  }

  async stopImpersonation(): Promise<void> {
    await this.stopImpersonationButton.click();
    await expect(this.stopImpersonationButton).toBeHidden();
  }

  async expectTileDisabled(tile: Locator): Promise<void> {
    await expect(tile).toHaveAttribute('aria-disabled', 'true');
    await expect(tile.locator(this.notAuthorizedWarning)).toBeAttached();
  }

  async expectTileEnabled(tile: Locator): Promise<void> {
    await expect(tile).not.toHaveAttribute('aria-disabled');
    await expect(tile.locator(this.notAuthorizedWarning)).toHaveCount(0);
  }

  async goToHomePage(): Promise<void> {
    await this.page.goto(HOME_URLS.home);
  }

  async backToHomePage(): Promise<void> {
    await this.backHomeLogo.click();
    await this.page.waitForLoadState();
  }

  async goToOperationalStudiesPage(): Promise<void> {
    await this.operationalStudiesTile.click();
    await expect(this.page).toHaveURL(HOME_URLS.operationalStudies);
  }

  async goToCartoPage(): Promise<void> {
    await this.referenceMapTile.click();
    await expect(this.page).toHaveURL(HOME_URLS.map);
  }

  async goToEditorPage(): Promise<void> {
    await this.infraEditorTile.click();
    await expect(this.page).toHaveURL(HOME_URLS.editor);
  }

  async goToRollingStockEditorPage(): Promise<void> {
    await this.rollingStockEditorTile.click();
    await expect(this.page).toHaveURL(HOME_URLS.rollingStockEditor);
  }

  async goToSTDCMPage(context: BrowserContext): Promise<Page> {
    const [stdcmPage] = await Promise.all([context.waitForEvent('page'), this.stdcmTile.click()]);
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
