import { Locator, Page } from '@playwright/test';

class PlaywrightMap {
  readonly getBtnShearch: Locator;

  readonly getBtnCloseShearch: Locator;

  readonly getSearchedStation: Locator;

  readonly getMap: Locator;

  readonly getBtnOrigin: Locator;

  readonly getBtnDestination: Locator;

  readonly getPathFindingResult: Locator;

  constructor(readonly page: Page) {
    this.getBtnShearch = page.locator('.btn-map-search');
    this.getBtnCloseShearch = page.locator('.map-modal').locator('.close');
    this.getSearchedStation = page.locator('#map-search-station');
    this.getMap = page.locator('.maplibregl-map.mapboxgl-map');
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

  async clickOnMap({ x, y }: { x: number; y: number }) {
    await this.getMap.click({ position: { x, y } });
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
}

export default PlaywrightMap;
