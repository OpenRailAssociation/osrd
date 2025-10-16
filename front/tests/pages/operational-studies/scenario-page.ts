import { type Locator, type Page, expect } from '@playwright/test';

import type { ScenarioDetails } from '../../utils/types';
import CommonPage from '../common-page';

class ScenarioPage extends CommonPage {
  private readonly scenarioEditionModal: Locator;

  private readonly scenarioUpdateButton: Locator;

  private readonly scenarioDeleteButton: Locator;

  private readonly scenarioConfirmUpdateButton: Locator;

  private readonly scenarioNameInput: Locator;

  private readonly scenarioDescriptionInput: Locator;

  private readonly scenarioInfraList: Locator;

  private readonly scenarioElectricProfileSelect: Locator;

  private readonly scenarioName: Locator;

  private readonly scenarioNameContainer: Locator;

  private readonly scenarioDescription: Locator;

  private readonly scenarioInfraName: Locator;

  private readonly addScenarioButton: Locator;

  private readonly createScenarioButton: Locator;

  private readonly scenarioTagsLabel: Locator;

  private readonly scenarioConfirmDeleteButton: Locator;

  readonly conflictsButton: Locator;

  readonly trainsButton: Locator;

  readonly simulationMapButton: Locator;

  readonly timeStopsOutputsButton: Locator;

  readonly macroEditorButton: Locator;

  readonly stdButton: Locator;

  readonly sddButton: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.scenarioUpdateButton = page.getByTestId('edit-scenario');
    this.scenarioEditionModal = page.getByTestId('scenario-edition-modal');
    this.scenarioDeleteButton = this.scenarioEditionModal.getByTestId('delete-scenario');
    this.addScenarioButton = page.getByTestId('add-scenario-button');
    this.scenarioNameInput = page.getByTestId('scenarioInputName-input');
    this.scenarioDescriptionInput = page.getByTestId('scenarioDescription-input');
    this.scenarioInfraList = page.getByTestId('infra-list');
    this.scenarioElectricProfileSelect = page.getByTestId('select-toggle');
    this.scenarioName = page.getByTestId('scenario-name-label');
    this.scenarioNameContainer = page.getByTestId('scenario-name-container');
    this.scenarioDescription = page.getByTestId('scenario-details-description');
    this.scenarioInfraName = page.getByTestId('scenario-infra-name');
    this.scenarioConfirmUpdateButton = this.scenarioEditionModal.getByTestId('update-scenario');
    this.createScenarioButton = page.getByTestId('create-scenario');
    this.scenarioTagsLabel = page.getByTestId('scenario-details-tag');
    this.scenarioConfirmDeleteButton = page.getByTestId('confirm-delete-button');
    this.conflictsButton = page.getByTestId('conflicts-button');
    this.trainsButton = page.getByTestId('trains-button');
    this.simulationMapButton = page.getByTestId('map-button');
    this.timeStopsOutputsButton = page.getByTestId('tables-button');
    this.macroEditorButton = page.getByTestId('macro-button');
    this.stdButton = page.getByTestId('std-button');
    this.sddButton = page.getByTestId('sdd-button');
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
    isUpdating = false,
  }: {
    name: string;
    description: string;
    infraName: string;
    tags?: string[];
    isUpdating?: boolean;
  }) {
    await expect(this.scenarioName).toBeVisible();
    await expect.poll(async () => this.scenarioName.textContent()).toContain(name);
    // Wait for the scenario name to be clickable if not updating
    // this is to prevent the description panel from being hidden
    if (!isUpdating) await this.scenarioNameContainer.click();
    const scenarioNameText = (await this.scenarioName.innerText()).slice(-1, 3);
    expect(name).toContain(scenarioNameText);
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
    await this.scenarioNameContainer.click();
    await this.scenarioUpdateButton.click();
  }

  async deleteScenario() {
    await this.scenarioDeleteButton.click();
    await expect(this.scenarioDeleteButton).not.toBeVisible();
    await expect(this.scenarioConfirmDeleteButton).toBeVisible();
    await this.scenarioConfirmDeleteButton.click();
    await expect(this.scenarioConfirmDeleteButton).not.toBeVisible();
    await this.page.waitForURL('**/studies/*');
  }
}

export default ScenarioPage;
