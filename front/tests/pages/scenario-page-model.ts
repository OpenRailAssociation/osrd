import { Locator, Page } from '@playwright/test';

class PlaywrightScenarioPage {
  readonly getRollingStockSelector: Locator;

  readonly getSpeedLimitSelector: Locator;

  readonly getItineraryModule: Locator;

  readonly getItineraryOrigin: Locator;

  readonly getItinenaryDestination: Locator;

  readonly getItineraryVias: Locator;

  readonly getTrainLabels: Locator;

  readonly getTrainSchedule: Locator;

  readonly getMapModule: Locator;

  readonly getSettingSimulationBtn: Locator;

  readonly getAddScenarioBtn: Locator;

  readonly getScenarioNameInput: Locator;

  readonly getScenarioDescriptionInput: Locator;

  readonly getScenarioInfraList: Locator;

  readonly getScenarioElectricProfileSelect: Locator;

  readonly getScenarioName: Locator;

  readonly getScenarioDesciption: Locator;

  readonly getScenarioInfraName: Locator;

  constructor(readonly page: Page) {
    this.getRollingStockSelector = page.getByTestId('rollingstock-selector');
    this.getSpeedLimitSelector = page.getByTestId('speed-limit-by-tag-selector');
    this.getItineraryModule = page.getByTestId('itinerary');
    this.getItineraryOrigin = this.getItineraryModule
      .getByTestId('display-itinerary')
      .getByTestId('itinerary-origin');
    this.getItinenaryDestination = this.getItineraryModule
      .getByTestId('display-itinerary')
      .getByTestId('itinerary-destination');
    this.getItineraryVias = this.getItineraryModule
      .getByTestId('display-itinerary')
      .getByTestId('itinerary-vias');
    this.getTrainLabels = page.getByTestId('add-train-labels');
    this.getTrainSchedule = page.getByTestId('add-train-schedules');
    this.getMapModule = page.getByTestId('map');
    this.getSettingSimulationBtn = page.locator('span', { hasText: 'Paramètres de simulation' });
    this.getAddScenarioBtn = page.getByRole('button', { name: 'Créer un scénario' });
    this.getScenarioNameInput = page.locator('#scenarioInputName');
    this.getScenarioDescriptionInput = page.locator('#scenarioDescription');
    this.getScenarioInfraList = page.getByTestId('infraslist');
    this.getScenarioElectricProfileSelect = page.locator('.input-group');
    this.getScenarioName = page.locator('.scenario-details-name .scenario-name');
    this.getScenarioDesciption = page.locator('.scenario-details-description');
    this.getScenarioInfraName = page.locator('.scenario-infra-name');
  }

  async openTabByText(text: string) {
    await this.page.locator('span', { hasText: text }).click();
  }

  async openScenarioByTestId(scenarioTestId: string) {
    await this.page
      .getByTestId(scenarioTestId)
      .getByRole('button', { name: 'Ouvrir' })
      .first()
      .click();
  }

  async openScenarioCreationModal() {
    await this.getAddScenarioBtn.click();
  }

  async setScenarioName(name: string) {
    await this.getScenarioNameInput.fill(name);
  }

  async setScenarioDescription(description: string) {
    await this.getScenarioDescriptionInput.fill(description);
  }

  async setSenarioInfraByName(infraName: string) {
    await this.getScenarioInfraList.getByText(infraName).first().click();
  }

  async setSenarioElectricProfileByName(electricProfileName: string) {
    await this.getScenarioElectricProfileSelect.click();
    await this.page.locator('[id="-selecttoggle"]').getByText(electricProfileName).click();
  }
}

export default PlaywrightScenarioPage;
