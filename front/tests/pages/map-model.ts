import { Locator, Page } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';

export interface selectPointOnMapProps {
  stationName: string;
  stationItemName: string | RegExp;
  positionClick: { x: number; y: number };
}

class PlaywrightMap {
  readonly getBtnShearch: Locator;

  readonly getBtnCloseShearch: Locator;

  readonly getSearchedStation: Locator;

  readonly getMap: Locator;

  readonly getBtnOrigin: Locator;

  readonly getBtnDestination: Locator;

  readonly getPathFindingResult: Locator;

  readonly playwrightHomePage: PlaywrightHomePage;

  constructor(readonly page: Page) {
    this.getBtnShearch = page.getByRole('button', { name: 'Search' });
    this.getBtnCloseShearch = page.locator('.map-modal').getByRole('button', { name: '×' });
    this.getSearchedStation = page.locator('#map-search-station');
    this.getMap = page.locator('.maplibregl-map');
    this.getBtnOrigin = page.locator('.map-popup-click-select').getByTestId('mapOrigin');
    this.getBtnDestination = page.locator('.map-popup-click-select').getByTestId('mapDestination');
    this.getPathFindingResult = page.locator('.pathfinding-done');
    this.playwrightHomePage = new PlaywrightHomePage(page);
  }

  async openMapSearch() {
    await this.getBtnShearch.click();
  }

  async closeMapSearch() {
    await this.getBtnCloseShearch.click();
  }

  async searchStation(station: string) {
    await this.getSearchedStation.fill(station);
  }

  async clickOnMap() {
    await this.getMap.click();
  }

  async clickOnOrigin() {
    await this.getBtnOrigin.first().click();
  }

  async clickOnDestination() {
    await this.getBtnDestination.click();
  }

  async checkPathFindingResult(result: string | RegExp) {
    await expect(this.getPathFindingResult).toHaveText(result);
  }

  async selectPointOnMap(args: selectPointOnMapProps & { isOrigin: boolean }) {
    const { stationName, stationItemName, isOrigin } = args;
    await this.openMapSearch();
    await this.searchStation(stationName);
    await this.playwrightHomePage.page
      .getByRole('button', { name: stationItemName })
      .first()
      .click();
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector('.maplibregl-marker');
    await this.clickOnMap();
    // We don't use ternaries here, as eslint warns us about rule no-unused-expressions
    if (isOrigin) {
      await this.clickOnOrigin();
    } else {
      await this.clickOnDestination();
    }
  }

  async selectOrigin(props: selectPointOnMapProps) {
    await this.selectPointOnMap({ ...props, isOrigin: true });
  }

  async selectDestination(props: selectPointOnMapProps) {
    await this.selectPointOnMap({ ...props, isOrigin: false });
  }
}

export default PlaywrightMap;
