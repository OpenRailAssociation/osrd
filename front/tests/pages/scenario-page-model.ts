import { Locator, Page, expect } from '@playwright/test';

class PlaywrightScenarioPage {
  readonly getRollingStockSelector: Locator;

  readonly getSpeedLimitSelector: Locator;

  readonly getItineraryModule: Locator;

  readonly getItineraryOrigin: Locator;

  readonly getItinenaryDestination: Locator;

  readonly getItineraryVias: Locator;

  readonly getTrainLabels: Locator;

  readonly getMapModule: Locator;

  readonly getSettingSimulationBtn: Locator;

  readonly getAddScenarioBtn: Locator;

  readonly getScenarioNameInput: Locator;

  readonly getScenarioDescriptionInput: Locator;

  readonly getScenarioInfraList: Locator;

  readonly getScenarioElectricProfileSelect: Locator;

  readonly getScenarioName: Locator;

  readonly getScenarioDescription: Locator;

  readonly getScenarioInfraName: Locator;

  readonly getResultPathfindingDistance: Locator;

  readonly getInfraLoadState: Locator;

  readonly getAddTrainScheduleBtn: Locator;

  readonly getTrainScheduleNameInput: Locator;

  readonly getTrainTimetable: Locator;

  readonly getReturnSimulationResultBtn: Locator;

  readonly getToastSNCF: Locator;

  readonly getToastSNCFTitle: Locator;

  readonly getPathfindingState: Locator;

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
    this.getMapModule = page.getByTestId('map');
    this.getSettingSimulationBtn = page.locator('span', { hasText: 'Paramètres de simulation' });
    this.getAddScenarioBtn = page.getByRole('button', { name: 'Créer un scénario' });
    this.getScenarioNameInput = page.locator('#scenarioInputName');
    this.getScenarioDescriptionInput = page.locator('#scenarioDescription');
    this.getScenarioInfraList = page.getByTestId('infraslist');
    this.getScenarioElectricProfileSelect = page.locator('.input-group');
    this.getScenarioName = page.locator('.scenario-details-name .scenario-name');
    this.getScenarioDescription = page.locator('.scenario-details-description');
    this.getScenarioInfraName = page.locator('.scenario-infra-name');
    this.getResultPathfindingDistance = page.getByTestId('result-pathfinding-distance');
    this.getInfraLoadState = page.locator('.infra-loading-state');
    this.getAddTrainScheduleBtn = page.getByTestId('add-train-schedules');
    this.getTrainScheduleNameInput = page.locator('#trainSchedule-name');
    this.getTrainTimetable = page
      .locator('.scenario-timetable-trains')
      .locator('.scenario-timetable-train');
    this.getReturnSimulationResultBtn = page.getByTestId('return-simulation-result');
    this.getToastSNCF = page.getByTestId('toast-SNCF');
    this.getToastSNCFTitle = this.getToastSNCF.getByTestId('toast-SNCF-title');
    this.getPathfindingState = page.locator('.pathfinding-state-main-container');
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

  async checkPathfindingDistance(distance: string | RegExp) {
    await expect(this.getResultPathfindingDistance).toHaveText(distance);
  }

  async checkInfraLoaded() {
    await this.page.waitForSelector('.cached');
    await expect(this.getInfraLoadState).toHaveClass(/cached/);
  }

  async addTrainSchedule() {
    await this.getAddTrainScheduleBtn.click();
  }

  async setTrainScheduleName(name: string) {
    await this.getTrainScheduleNameInput.fill(name);
    await expect(this.getTrainScheduleNameInput).toHaveValue(name);
  }

  async checkNumberOfTrains(number: number) {
    await expect(this.getTrainTimetable).toHaveCount(number);
  }

  async returnSimulationResult() {
    await this.getReturnSimulationResultBtn.click();
  }

  async checkToastSNCFTitle(title: string | RegExp) {
    await expect(this.getToastSNCFTitle).toHaveText(title);
  }

  async checkToastSNCFBody(text: string | RegExp) {
    await expect(this.getToastSNCF.locator('.toast-body')).toHaveText(text);
  }

  getTrainTimetableByName(name: string | RegExp) {
    return this.page.getByRole('button', { name });
  }

  async checkPathfingingStateText(text: string | RegExp) {
    await expect(this.getPathfindingState).toHaveText(text);
  }
}

export default PlaywrightScenarioPage;
