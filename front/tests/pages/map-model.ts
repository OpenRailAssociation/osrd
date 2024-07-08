import { type Locator, type Page, expect } from '@playwright/test';

import HomePage from './home-page-model';

export interface selectPointOnMapProps {
  stationName: string;
  stationItemName: string | RegExp;
  positionClick: { x: number; y: number };
}

class MapPage {
  readonly getBtnShearch: Locator;

  readonly getBtnCloseShearch: Locator;

  readonly getSearchedStation: Locator;

  readonly getMap: Locator;

  readonly getBtnOrigin: Locator;

  readonly getBtnDestination: Locator;

  readonly getPathFindingResult: Locator;

  readonly homePage: HomePage;

  constructor(readonly page: Page) {
    this.getBtnShearch = page.getByRole('button', { name: 'Search' });
    this.getBtnCloseShearch = page.locator('.map-modal').getByRole('button', { name: '×' });
    this.getSearchedStation = page.locator('#map-search-station');
    this.getMap = page.locator('.maplibregl-map');
    this.getBtnOrigin = page.locator('.map-popup-click-select').getByTestId('map-origin-button');
    this.getBtnDestination = page
      .locator('.map-popup-click-select')
      .getByTestId('map-destination-button');
    this.getPathFindingResult = page.locator('.pathfinding-done');
    this.homePage = new HomePage(page);
  }

  async disableLayers() {
    const mapSettings = this.page.getByTestId('button-map-settings');
    await mapSettings.click();
    const showOsmSwitch = this.page.getByTestId('show-osm-switch');
    await showOsmSwitch.uncheck({ force: true });
    const closeSettingsModalButton = this.page.getByTestId('close-modal');
    await closeSettingsModalButton.click();
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

  /** click on the center of the map */
  async clickOnMap() {
    await this.getMap.click();
  }

  async clickOnOrigin() {
    await this.getBtnOrigin.click();
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
    await this.homePage.page.getByRole('button', { name: stationItemName }).first().click();
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
export default MapPage;
