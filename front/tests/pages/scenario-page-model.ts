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
  private readonly scenarioUpdateButton: Locator;

  private readonly scenarioConfirmDeleteButton: Locator;

  private readonly scenarioConfirmUpdateButton: Locator;

  private readonly scenarioNameInput: Locator;

  private readonly scenarioDescriptionInput: Locator;

  private readonly scenarioInfraList: Locator;

  private readonly scenarioElectricProfileSelect: Locator;

  private readonly scenarioName: Locator;

  private readonly scenarioDescription: Locator;

  private readonly scenarioInfraName: Locator;

  private readonly addScenarioButton: Locator;

  private readonly createScenarioButton: Locator;

  private readonly scenarioTagsLabel: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.scenarioUpdateButton = page.getByTestId('edit-scenario');
    this.scenarioConfirmDeleteButton = page
      .locator('#modal-content')
      .getByTestId('delete-scenario');
    this.addScenarioButton = page.getByTestId('add-scenario-button');
    this.scenarioNameInput = page.locator('#scenarioInputName');
    this.scenarioDescriptionInput = page.locator('#scenarioDescription');
    this.scenarioInfraList = page.getByTestId('infra-list');
    this.scenarioElectricProfileSelect = page.locator('.input-group');
    this.scenarioName = page.locator('.scenario-details-name .scenario-name');
    this.scenarioDescription = page.locator('.scenario-details-description');
    this.scenarioInfraName = page.locator('.scenario-infra-name');
    this.scenarioConfirmUpdateButton = page
      .locator('#modal-content')
      .getByTestId('update-scenario');
    this.createScenarioButton = page.getByTestId('create-scenario');
    this.scenarioTagsLabel = page.getByTestId('scenario-details-tag');
  }

  // Create a scenario based on the provided details.
  async createScenario(details: ScenarioDetails) {
    await expect(this.addScenarioButton).toBeVisible();
    await this.addScenarioButton.click();
    await this.fillScenarioDetails(details);
    await this.createScenarioButton.click();
    await this.page.waitForURL('**/scenarios/*');
  }

  // Update a scenario based on the provided details.
  async updateScenario(details: ScenarioDetails) {
    await this.clickOnUpdateScenario();
    await this.fillScenarioDetails(details);
    await this.scenarioConfirmUpdateButton.click();
    await this.page.waitForURL('**/scenarios/*');
  }

  // Fill the scenario details in the form inputs.
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

  // Validate if all scenario details are displayed correctly.
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

  // Retrieve a scenario by its name.
  getScenarioByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  // Retrieve scenario tags by ID.
  getScenarioTags(id: string) {
    return this.page.getByTestId(`scenario-card-${id}`).locator('.scenario-card-tags');
  }

  // Open a Scenario by its test ID (The Test ID is the same as the Name).
  async openScenarioByTestId(scenarioTestId: string) {
    await this.page.getByTestId(scenarioTestId).first().hover({ trial: true });
    await this.page.getByTestId(scenarioTestId).getByTestId('openScenario').click();
  }

  // Set the scenario electric profile by name.
  async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.scenarioElectricProfileSelect.click();
    await this.page.locator('#select-toggle').getByText(electricProfileName).click();
  }

  // Click on the update scenario button.
  async clickOnUpdateScenario() {
    await this.scenarioDescription.hover();
    await this.scenarioUpdateButton.click();
  }

  // Delete a scenario.
  async deleteScenario() {
    await this.scenarioConfirmDeleteButton.click();
    await expect(this.scenarioConfirmDeleteButton).not.toBeVisible();
    await this.page.waitForURL('**/studies/*');
  }
}

export default ScenarioPage;
