import { expect, type Locator, type Page } from '@playwright/test';

import { SCENARIO_URLS } from '../../assets/operation-studies/scenario-const';
import { STUDY_URLS } from '../../assets/operation-studies/study-const';
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

  constructor(page: Page) {
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

  private getScenarioByName(scenarioName: string): Locator {
    return this.page.getByTestId(scenarioName);
  }

  private openScenarioButton(scenarioName: string): Locator {
    return this.getScenarioByName(scenarioName).getByTestId('openScenario');
  }
  private getScenarioTags(id: string): Locator {
    return this.page.getByTestId(`scenario-card-${id}`).getByTestId('scenario-card-tags');
  }

  private getElectricProfileOptionByName(name: string): Locator {
    const list = this.page.getByRole('list');
    return list.getByRole('button', { name });
  }

  async createScenario(details: ScenarioDetails) {
    await expect(this.addScenarioButton).toBeVisible();
    await this.addScenarioButton.click();
    await this.fillScenarioDetails(details);
    await this.createScenarioButton.click();
    await this.page.waitForURL(SCENARIO_URLS.detail);
  }

  async updateScenario(details: ScenarioDetails) {
    await this.openScenarioEditForm();
    await this.fillScenarioDetails(details);
    await this.scenarioConfirmUpdateButton.click();
    await expect(this.scenarioEditionModal).toBeHidden();
    await this.page.waitForURL(SCENARIO_URLS.detail);
    await this.page.waitForLoadState();
  }

  private async fillScenarioDetails({
    name,
    description,
    infraName,
    tags,
    electricProfileName,
  }: ScenarioDetails) {
    await this.scenarioNameInput.fill(name);
    await this.scenarioDescriptionInput.fill(description);
    if (electricProfileName) await this.setScenarioElectricProfileByName(electricProfileName);
    if (infraName) await this.scenarioInfraList.getByText(infraName).first().click();
    for (const tag of tags ?? []) await this.setTag(tag);
  }

  async validateScenarioData({
    name,
    description,
    infraName,
    tags,
    isUpdating = false,
  }: ScenarioDetails & { isUpdating?: boolean }) {
    if (!isUpdating) await this.scenarioNameContainer.click();
    await expect(this.scenarioName).toContainText(name);
    await expect(this.scenarioDescription).toContainText(description);
    if (infraName) await expect(this.scenarioInfraName).toContainText(infraName);
    if (tags) await expect(this.scenarioTagsLabel).toContainText(tags.join(''));
  }

  async expectScenarioTags(scenarioName: string, expectedTags: string) {
    await expect(this.getScenarioTags(scenarioName)).toContainText(expectedTags);
  }

  async assertScenarioNotVisible(name: string) {
    await expect(this.getScenarioByName(name)).not.toBeVisible();
  }

  async openScenarioByName(scenarioName: string) {
    await expect(this.getScenarioByName(scenarioName)).toBeVisible();
    await this.getScenarioByName(scenarioName).hover();
    await this.openScenarioButton(scenarioName).click();
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
    await this.page.waitForURL(STUDY_URLS.detail);
  }

  private async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.scenarioElectricProfileSelect.click();
    await this.getElectricProfileOptionByName(electricProfileName).click();
  }
}

export default ScenarioPage;
