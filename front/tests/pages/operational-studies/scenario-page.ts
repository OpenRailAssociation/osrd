import { type Locator, type Page, expect } from '@playwright/test';

import type { ScenarioDetails } from '../../utils/types';
import CommonPage from '../common-page';

class ScenarioPage extends CommonPage {
  private readonly scenarioEditionModal: Locator;

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
    this.scenarioEditionModal = page.getByTestId('scenario-edition-modal');
    this.scenarioConfirmDeleteButton = this.scenarioEditionModal.getByTestId('delete-scenario');
    this.addScenarioButton = page.getByTestId('add-scenario-button');
    this.scenarioNameInput = page.locator('#scenarioInputName');
    this.scenarioDescriptionInput = page.locator('#scenarioDescription');
    this.scenarioInfraList = page.getByTestId('infra-list');
    this.scenarioElectricProfileSelect = page.locator('.input-group');
    this.scenarioName = page.locator('.scenario-details-name .scenario-name');
    this.scenarioDescription = page.locator('.scenario-details-description');
    this.scenarioInfraName = page.locator('.scenario-infra-name');
    this.scenarioConfirmUpdateButton = this.scenarioEditionModal.getByTestId('update-scenario');
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
    await this.openScenarioEditForm();
    await this.fillScenarioDetails(details);
    await this.scenarioConfirmUpdateButton.click();
    await expect(this.scenarioEditionModal).toBeHidden();
    await this.page.waitForURL('**/scenarios/*');
    await this.page.waitForLoadState();
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
    await expect(this.scenarioName).toBeVisible();
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

  async openScenarioByName(scenarioName: string) {
    await this.page.getByTestId(scenarioName).first().hover({ trial: true });
    await this.page.getByTestId(scenarioName).getByTestId('openScenario').click();
  }

  // Set the scenario electric profile by name.
  private async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.scenarioElectricProfileSelect.click();
    await this.page.locator('#select-toggle').getByText(electricProfileName).click();
  }

  async openScenarioEditForm() {
    await this.scenarioDescription.hover();
    await this.scenarioUpdateButton.click();
  }

  async deleteScenario() {
    await this.scenarioConfirmDeleteButton.click();
    await expect(this.scenarioConfirmDeleteButton).not.toBeVisible();
    await this.page.waitForURL('**/studies/*');
  }
}

export default ScenarioPage;
