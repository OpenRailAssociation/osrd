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

  readonly getResultPathfindingDistance: Locator;

  readonly getInfraLoadState: Locator;

  readonly getAddTrainScheduleBtn: Locator;

  readonly getTrainScheduleNameInput: Locator;

  readonly getTrainTimetable: Locator;

  readonly getReturnSimulationResultBtn: Locator;

  readonly getToastSNCF: Locator;

  readonly getToastSNCFTitle: Locator;

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
  }

  async openTabByText(text: string) {
    await this.page.locator('span', { hasText: text }).click();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await expect(this.getResultPathfindingDistance).toHaveText(distance);
  }

  async checkInfraLoaded() {
    await expect(this.getInfraLoadState).toHaveClass(/cached/);
  }

  async addTrainSchedule() {
    await this.getAddTrainScheduleBtn.click();
  }

  async setTrainScheduleName(name: string) {
    await this.getTrainScheduleNameInput.fill(name);
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

  getTrainTimetbleByName(name: string | RegExp) {
    return this.page.getByRole('button', { name });
  }
}

export default PlaywrightScenarioPage;
