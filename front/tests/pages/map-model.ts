import { Locator, Page, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';

export interface selectPointOnMapProps {
  stationName: string;
  stationItemName: string | RegExp;
  positionClick: { x: number; y: number };
}

class PlaywrightMap {
  readonly getBtnSearch: Locator;

  readonly getBtnSettings: Locator;

  readonly getBtnShowOSM: Locator;

  readonly getFirstStepTerrainExaggerationSlider: Locator;

  readonly getBtnCloseMapModal: Locator;

  readonly getSearchedStation: Locator;

  readonly getMap: Locator;

  readonly getMapOnClickPopup: Locator;

  readonly getBtnOrigin: Locator;

  readonly getBtnDestination: Locator;

  readonly getPathFindingResult: Locator;

  readonly playwrightHomePage: PlaywrightHomePage;

  constructor(readonly page: Page) {
    this.getBtnSearch = page.locator('.btn-map-container').getByRole('button', { name: 'Search' });
    this.getBtnSettings = page
      .locator('.btn-map-container')
      .getByRole('button', { name: 'Settings' });
    this.getBtnShowOSM = page.locator('.switch-control', { has: page.locator('#showosmswitch') });
    this.getFirstStepTerrainExaggerationSlider = page.locator('.rc-slider-dot').first();
    this.getBtnCloseMapModal = page.locator('.map-modal').getByRole('button', { name: '×' });
    this.getSearchedStation = page.locator('#map-search-station');
    this.getMap = page.locator('.maplibregl-map');
    this.getMapOnClickPopup = page.locator('.map-popup-click-select');
    this.getBtnOrigin = page.getByRole('button').filter({ hasText: 'Origine' });
    this.getBtnDestination = page.getByRole('button').filter({ hasText: 'Destination' });
    this.getPathFindingResult = page.locator('.pathfinding-done');
    this.playwrightHomePage = new PlaywrightHomePage(page);
  }

  async openMapSearch() {
    await this.getBtnSearch.click();
  }

  async openMapSettigns() {
    await this.getBtnSettings.click();
  }

  async clickOnShowOSM() {
    await this.getBtnShowOSM.click();
  }

  async putTerrainExaggerationToZero() {
    await this.getFirstStepTerrainExaggerationSlider.click();
  }

  async closeMapModal() {
    await this.getBtnCloseMapModal.click();
  }

  async searchStation(station: string) {
    await this.getSearchedStation.focus(); // needed to trigger debounce
    await this.getSearchedStation.fill(station);
  }

  /**
   * Click on a position of the map
   * @param relative is position are relative to the map or the screen ?
   */
  async clickOnMap(position: { x: number; y: number }) {
    await this.getMap.click({ position });
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
    const { stationName, stationItemName, positionClick, isOrigin } = args;

    await this.openMapSearch();
    const searchApiResponse = this.playwrightHomePage.page.waitForResponse(
      (resp) => resp.url().includes('/search') && resp.status() === 200
    );
    await this.searchStation(stationName);
    await searchApiResponse;

    await this.playwrightHomePage.page
      .getByRole('button', { name: stationItemName })
      .first()
      .click();

    // just a test to see where playwright is clicking on the map
    // with its trace
    await this.clickOnMap(positionClick);
    await expect
      .poll(
        async () => {
          await this.clickOnMap(positionClick);
          return this.getMapOnClickPopup.isVisible();
        },
        {
          timeout: 30000,
        }
      )
      .toBe(true);
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

  async turnOffMapBackgroundLayers() {
    await this.openMapSettigns();
    await this.clickOnShowOSM();
    await this.putTerrainExaggerationToZero();
  }
}

export default PlaywrightMap;
