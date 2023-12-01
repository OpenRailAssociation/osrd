import { Locator, Page } from '../baseFixtures';
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
    this.getBtnOrigin = page.getByRole('button').filter({ hasText: 'Origine' });
    this.getBtnDestination = page.getByRole('button').filter({ hasText: 'Destination' });
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
    await this.searchStation(stationName);
    await this.playwrightHomePage.page
      .getByRole('button', { name: stationItemName })
      .first()
      .click();
    await this.closeMapSearch();
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector('.maplibregl-marker');
    await this.clickOnMap(positionClick);
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
