import { Locator, Page } from '@playwright/test';

class PlaywrightMap {
  readonly getMap: Locator;

  readonly getBtnShearch: Locator;

  readonly getBtnCloseShearch: Locator;

  readonly getSearchedStation: Locator;

  readonly getMapLibreBox: Locator;

  readonly getBtnOrigin: Locator;

  readonly getBtnDestination: Locator;

  readonly getPathFindingResult: Locator;

  constructor(readonly page: Page) {
    this.getMap = page.getByTestId('map');
    this.getBtnShearch = this.getMap.getByRole('button', { name: /Search/ });
    this.getBtnCloseShearch = page.locator('.map-modal').locator('.close');
    this.getSearchedStation = page.locator('#map-search-station');
    this.getMapLibreBox = this.getMap.locator('.maplibregl-map.mapboxgl-map');
    this.getBtnOrigin = page.getByRole('button').filter({ hasText: 'Origine' });
    this.getBtnDestination = page.getByRole('button').filter({ hasText: 'Destination' });
    this.getPathFindingResult = page.locator('.pathfinding-done');
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

  async clickOnMap(position: { x: number; y: number }) {
    await this.getMapLibreBox.click({ position });
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

  async addTimeoutForMapToLoad(timer: number) {
    await this.page.waitForTimeout(timer);
  }
}

export default PlaywrightMap;
