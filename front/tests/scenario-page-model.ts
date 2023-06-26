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

  readonly getAddTrainScheduleBtn: Locator;

  readonly getTrainScheduleNameInput: Locator;

  readonly getTrainsTimetable: Locator;

  readonly getReturnSimulationResultBtn: Locator;

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
    this.getAddTrainScheduleBtn = page.getByTestId('add-train-schedules');
    this.getTrainScheduleNameInput = page.locator('#trainSchedule-name');
    this.getTrainsTimetable = page
      .locator('.scenario-timetable-trains')
      .locator('.scenario-timetable-train');
    this.getReturnSimulationResultBtn = page.getByTestId('return-simulation-result');
  }

  async openTabByText(text: string) {
    await this.page.locator('span', { hasText: text }).click();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await expect(this.getResultPathfindingDistance).toHaveText(distance);
  }

  async addTrainSchedule() {
    await this.getAddTrainScheduleBtn.click();
  }

  async setTrainScheduleName(name: string) {
    await this.getTrainScheduleNameInput.fill(name);
  }

  async checkNumberOfTrains(number: number) {
    await expect(this.getTrainsTimetable).toHaveCount(number);
  }

  async returnSimulationResult() {
    await this.getReturnSimulationResultBtn.click();
  }
}

export default PlaywrightScenarioPage;
