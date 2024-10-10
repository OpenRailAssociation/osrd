import { type Locator, type Page, expect } from '@playwright/test';

import CommonPage from './common-page-model';

class ScenarioPage extends CommonPage {
  readonly scenarioUpdateButton: Locator;

  readonly scenarioConfirmDeleteButton: Locator;

  readonly trainLabels: Locator;

  readonly scenarioConfirmUpdateButton: Locator;

  readonly scenarioNameInput: Locator;

  readonly scenarioDescriptionInput: Locator;

  readonly scenarioInfraList: Locator;

  readonly scenarioElectricProfileSelect: Locator;

  readonly scenarioName: Locator;

  readonly scenarioDescription: Locator;

  readonly scenarioInfraName: Locator;

  readonly trainEditButton: Locator;

  readonly addScenarioButton: Locator;

  readonly createScenarioButton: Locator;

  readonly scenarioTagsLabel: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.scenarioUpdateButton = page.getByTestId('editScenario');
    this.scenarioConfirmDeleteButton = page
      .locator('#modal-content')
      .getByTestId('delete-scenario');
    this.trainLabels = page.getByTestId('add-train-labels');
    this.addScenarioButton = page.getByTestId('add-scenario-button');
    this.scenarioNameInput = page.locator('#scenarioInputName');
    this.scenarioDescriptionInput = page.locator('#scenarioDescription');
    this.scenarioInfraList = page.getByTestId('infra-list');
    this.scenarioElectricProfileSelect = page.locator('.input-group');
    this.scenarioName = page.locator('.scenario-details-name .scenario-name');
    this.scenarioDescription = page.locator('.scenario-details-description');
    this.scenarioInfraName = page.locator('.scenario-infra-name');
    this.trainEditButton = page.locator('.scenario-timetable-train-buttons-update');
    this.scenarioConfirmUpdateButton = page.locator('#modal-content').getByTestId('updateScenario');
    this.createScenarioButton = page.getByTestId('createScenario');
    this.scenarioTagsLabel = page.getByTestId('scenario-details-tag');
  }

  // Creates or updates a scenario based on the provided details.
  async createOrUpdateScenario({
    name,
    description,
    tags,
    infraName,
    electricProfileName,
    isUpdate = false,
  }: {
    name: string;
    description: string;
    tags: string[];
    infraName?: string;
    electricProfileName?: string;
    isUpdate?: boolean;
  }) {
    if (isUpdate) {
      await this.clickOnUpdateScenario();
    } else {
      expect(this.addScenarioButton).toBeVisible();
      await this.addScenarioButton.click();
    }

    await this.fillScenarioDetails({
      name,
      description,
      tags,
      infraName,
      electricProfileName,
    });
    await (isUpdate ? this.scenarioConfirmUpdateButton.click() : this.createScenarioButton.click());
    await this.page.waitForURL('**/scenarios/*');
  }

  // Fills the scenario details in the form inputs.
  private async fillScenarioDetails({
    name,
    description,
    infraName,
    tags,
    electricProfileName,
  }: {
    name: string;
    description: string;
    tags: string[];
    infraName?: string;
    electricProfileName?: string;
  }) {
    await this.scenarioNameInput.fill(name);
    await this.scenarioDescriptionInput.fill(description);

    // Check if electricProfileName is provided and not empty, then set the profile
    if (electricProfileName && !process.env.CI) {
      await this.setScenarioElectricProfileByName(electricProfileName);
    }
    if (infraName) {
      await this.scenarioInfraList.getByText(infraName).first().click();
    }

    for (const tag of tags) {
      await this.setTag(tag);
    }
  }

  // Validates if all project details are displayed correctly.
  async validateScenarioData({
    name,
    description,
    infraName,
    tags,
  }: {
    name: string;
    description: string;
    infraName: string;
    tags?: string[];
  }) {
    expect(await this.scenarioName.textContent()).toContain(name);
    expect(await this.scenarioDescription.textContent()).toContain(description);
    expect(await this.scenarioInfraName.textContent()).toContain(infraName);
    if (tags) {
      expect(await this.scenarioTagsLabel.textContent()).toContain(tags.join(''));
    }
  }

  getScenarioByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  getScenarioTags(id: string) {
    return this.page.getByTestId(`scenario-card-${id}`).locator('.scenario-card-tags');
  }

  async openScenarioByTestId(scenarioTestId: string) {
    await this.page.getByTestId(scenarioTestId).getByTestId('openScenario').first().click();
  }

  async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.scenarioElectricProfileSelect.click();
    await this.page.locator('#-selecttoggle').getByText(electricProfileName).click();
  }

  // Click on update scenario button
  async clickOnUpdateScenario() {
    await this.scenarioDescription.hover();
    await this.scenarioUpdateButton.click();
  }

  // Delete scenario
  async deleteScenario() {
    await this.scenarioConfirmDeleteButton.click();
    await this.page.waitForURL('**/studies/*');
  }
}

export default ScenarioPage;
