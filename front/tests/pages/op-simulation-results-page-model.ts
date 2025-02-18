import { type Locator, type Page } from '@playwright/test';

class OpSimulationResultPage {
  readonly page: Page;

  private readonly speedSpaceChartSettingsButton: Locator;

  private readonly speedSpaceChartCheckboxItems: Locator;

  readonly speedSpaceChartTabindexElement: Locator;

  private readonly speedSpaceChartCloseSettingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.speedSpaceChartSettingsButton = page.locator('.interaction-button.elipsis-button');
    this.speedSpaceChartCloseSettingsButton = page.locator('#close-settings-panel');
    this.speedSpaceChartCheckboxItems = page.locator('#settings-panel .selection .checkmark');
    this.speedSpaceChartTabindexElement = page.locator(
      '#container-SpeedSpaceChart > div[tabindex="0"]'
    );
  }

  private async openSettingsPanel(): Promise<void> {
    await this.speedSpaceChartSettingsButton.click();
  }

  private async closeSettingsPanel(): Promise<void> {
    await this.speedSpaceChartCloseSettingsButton.click();
  }

  // Ensures all checkboxes in the settings panel are checked.
  async selectAllSpeedSpaceChartCheckboxes(): Promise<void> {
    await this.openSettingsPanel();

    const checkboxes = await this.speedSpaceChartCheckboxItems.all();
    await Promise.all(checkboxes.map((checkbox) => checkbox.setChecked(true, { force: true })));
    await this.closeSettingsPanel();
    await this.speedSpaceChartSettingsButton.hover(); // Hover over the element to prevent the tooltip from displaying
  }
}

export default OpSimulationResultPage;
