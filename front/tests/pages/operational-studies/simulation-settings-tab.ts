import { type Locator, type Page, expect } from '@playwright/test';

class SimulationSettingsTab {
  readonly page: Page;

  private readonly electricalProfilesSwitch: Locator;

  private readonly linearMarginSwitch: Locator;

  private readonly marecoMarginSwitch: Locator;

  private readonly speedLimitTagSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.electricalProfilesSwitch = page.getByTestId('usingElectricalProfiles');
    this.linearMarginSwitch = page.getByTestId('constraint-distribution-switch-STANDARD-label');
    this.marecoMarginSwitch = page.getByTestId('constraint-distribution-switch-MARECO-label');
    this.speedLimitTagSelector = page.locator('#speed-limit-by-tag-selector');
  }

  // Validate that the electrical profiles switch is ON
  async checkElectricalProfile() {
    await expect(this.electricalProfilesSwitch).toBeVisible();
    await expect(this.electricalProfilesSwitch).toBeChecked();
  }

  async deactivateElectricalProfile() {
    await this.electricalProfilesSwitch.setChecked(false, { force: true });
    await expect(this.electricalProfilesSwitch).not.toBeChecked();
  }

  async activateLinearMargin() {
    await expect(this.linearMarginSwitch).toBeVisible();
    await this.linearMarginSwitch.click();
  }

  // Validate that the Mareco Margin switch is ON
  async checkMarecoMargin() {
    await expect(this.marecoMarginSwitch).toBeVisible();
    await expect(this.marecoMarginSwitch).toBeChecked();
  }

  async activateMarecoMargin() {
    await expect(this.marecoMarginSwitch).toBeVisible();
    await this.marecoMarginSwitch.click();
  }

  async selectSpeedLimitTagOption(speedLimitTag: string) {
    await this.speedLimitTagSelector.selectOption({ value: speedLimitTag });
    await expect(this.speedLimitTagSelector).toHaveValue(speedLimitTag);
  }
}
export default SimulationSettingsTab;
