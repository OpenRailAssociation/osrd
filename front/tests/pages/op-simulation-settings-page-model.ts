import { type Locator, type Page, expect } from '@playwright/test';

class OperationalStudiesSimulationSettingsPage {
  readonly page: Page;

  readonly electricalProfilesSwitch: Locator;

  readonly linearMarginSwitch: Locator;

  readonly marecoMarginSwitch: Locator;

  readonly codeCompoSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.electricalProfilesSwitch = page.locator('#usingElectricalProfiles');
    this.linearMarginSwitch = page.locator('#constraint-distribution-switchSTANDARD + label');
    this.marecoMarginSwitch = page.locator('#constraint-distribution-switchMARECO + label');
    this.codeCompoSelector = page.locator('#speed-limit-by-tag-selector');
  }

  // Validate that the electrical profiles switch is ON
  async checkElectricalProfile() {
    await expect(this.electricalProfilesSwitch).toBeVisible();
    await expect(this.electricalProfilesSwitch).toBeChecked();
  }

  // Deactivate electrical profiles switch
  async deactivateElectricalProfile() {
    await this.electricalProfilesSwitch.setChecked(false, { force: true });
    expect(this.electricalProfilesSwitch).not.toBeChecked();
  }

  async activateLinearMargin() {
    await this.linearMarginSwitch.click();
  }

  // Validate that the Mareco Margin switch is ON
  async checkMarecoMargin() {
    await expect(this.marecoMarginSwitch).toBeVisible();
    await expect(this.marecoMarginSwitch).toBeChecked();
  }

  async activateMarecoMargin() {
    await this.marecoMarginSwitch.click();
  }

  async selectCodeCompoOption(codeCompo: string) {
    await this.codeCompoSelector.selectOption({ value: codeCompo });
    await expect(this.codeCompoSelector).toHaveValue(codeCompo);
  }
}
export default OperationalStudiesSimulationSettingsPage;
