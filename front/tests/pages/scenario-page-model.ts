import { type Locator, type Page, expect } from '@playwright/test';

import CommonPage from './common-page-model';

// Define the type for scenario details
type ScenarioDetails = {
  name: string;
  description: string;
  tags: string[];
  infraName?: string;
  electricProfileName?: string;
};

class ScenarioPage extends CommonPage {
  // Page Locators
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

    this.scenarioUpdateButton = page.getByTestId('edit-scenario');
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
    this.scenarioConfirmUpdateButton = page
      .locator('#modal-content')
      .getByTestId('update-scenario');
    this.createScenarioButton = page.getByTestId('create-scenario');
    this.scenarioTagsLabel = page.getByTestId('scenario-details-tag');
  }

  // Creates a scenario based on the provided details.
  async createScenario(details: ScenarioDetails) {
    expect(this.addScenarioButton).toBeVisible();
    await this.addScenarioButton.click();
    await this.fillScenarioDetails(details);
    await this.createScenarioButton.click();
    await this.page.waitForURL('**/scenarios/*');
  }

  // Updates a scenario based on the provided details.
  async updateScenario(details: ScenarioDetails) {
    await this.clickOnUpdateScenario();
    await this.fillScenarioDetails(details);
    await this.scenarioConfirmUpdateButton.click();
    await this.page.waitForURL('**/scenarios/*');
  }

  // Fills the scenario details in the form inputs.
  private async fillScenarioDetails({
    name,
    description,
    infraName,
    tags,
    electricProfileName,
  }: ScenarioDetails) {
    await this.scenarioNameInput.fill(name);
    await this.scenarioDescriptionInput.fill(description);

    // Set electric profile if provided
    if (electricProfileName) {
      await this.setScenarioElectricProfileByName(electricProfileName);
    }

    // Select infra name if provided
    if (infraName) {
      await this.scenarioInfraList.getByText(infraName).first().click();
    }

    // Set scenario tags
    for (const tag of tags) {
      await this.setTag(tag);
    }
  }

  // Validates if all scenario details are displayed correctly.
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

  // Retrieves a scenario by its name.
  getScenarioByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  // Retrieves scenario tags by ID.
  getScenarioTags(id: string) {
    return this.page.getByTestId(`scenario-card-${id}`).locator('.scenario-card-tags');
  }

  // Opens a Scenario by its test ID (The Test ID is the same as the Name).
  async openScenarioByTestId(scenarioTestId: string) {
    await this.page.getByTestId(scenarioTestId).first().hover({ trial: true });
    await this.page.getByTestId(scenarioTestId).getByTestId('openScenario').click();
  }

  // Sets the scenario electric profile by name.
  async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.scenarioElectricProfileSelect.click();
    await this.page.locator('#-selecttoggle').getByText(electricProfileName).click();
  }

  // Click on the update scenario button.
  async clickOnUpdateScenario() {
    await this.scenarioDescription.hover();
    await this.scenarioUpdateButton.click();
  }

  // Deletes a scenario.
  async deleteScenario() {
    await this.scenarioConfirmDeleteButton.click();
    await expect(this.scenarioConfirmDeleteButton).not.toBeVisible();
    await this.page.waitForURL('**/studies/*');
  }
}

export default ScenarioPage;
