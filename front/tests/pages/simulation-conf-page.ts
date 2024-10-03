import { type Locator, type Page, expect } from '@playwright/test';

import RollingStockSelectorPage from './rollingstock-selector-page';

class SimulationConfPage extends RollingStockSelectorPage {
  readonly infraLoadingState: Locator;

  readonly pathfindingState: Locator;

  readonly pathfindingResultDistance: Locator;

  readonly pathfindingDoneLabel: Locator;

  readonly searchByTrigramRocketButton: Locator;

  readonly searchByTrigramContainer: Locator;

  readonly searchByTrigramInput: Locator;

  readonly searchByTrigramSubmitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pathfindingResultDistance = page.getByTestId('result-pathfinding-distance');
    this.infraLoadingState = page.locator('.infra-loading-state');
    this.pathfindingState = page.locator('.pathfinding-state-main-container');
    this.searchByTrigramRocketButton = page.getByTestId('rocket-button');
    this.searchByTrigramContainer = page.getByTestId('type-and-path-container');
    this.searchByTrigramInput = page.getByTestId('type-and-path-input');
    this.pathfindingDoneLabel = page.getByTestId('result-pathfinding-done');
    this.searchByTrigramSubmitButton = page.getByTestId('submit-search-by-trigram');
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await this.page.waitForSelector('[data-testid="result-pathfinding-distance"]');
    await expect(this.pathfindingResultDistance).toHaveText(distance);
  }

  async checkInfraIsLoaded() {
    await this.page.waitForSelector('.cached');
    await expect(this.infraLoadingState).toHaveClass(/cached/);
  }

  async checkPathfindingStateText(text: string | RegExp) {
    await expect(this.pathfindingState).toHaveText(text);
  }

  async selectPathByTrigram(firstTrigram: string, secondTrigram: string) {
    await this.searchByTrigramRocketButton.click();
    await expect(this.searchByTrigramContainer).toBeVisible();
    await this.searchByTrigramInput.fill(`${firstTrigram} ${secondTrigram}`);
    await expect(
      this.page.getByTestId(`typeandpath-op-${firstTrigram}`) &&
        this.page.getByTestId(`typeandpath-op-${secondTrigram}`)
    ).toBeVisible();
    await this.searchByTrigramSubmitButton.click();
    await expect(this.pathfindingDoneLabel).toBeVisible();
  }
}
export default SimulationConfPage;
