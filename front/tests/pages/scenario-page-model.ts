import { Locator, Page, expect } from '../baseFixtures';

class PlaywrightScenarioPage {
  readonly getScenarioUpdateBtn: Locator;

  readonly getScenarioDeleteConfirmBtn: Locator;

  readonly getScenarioTags: Locator;

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

  readonly getScenarioUpdateConfirmBtn: Locator;

  readonly getScenarioNameInput: Locator;

  readonly getScenarioDescriptionInput: Locator;

  readonly getScenarioInfraList: Locator;

  readonly getScenarioElectricProfileSelect: Locator;

  readonly getScenarioName: Locator;

  readonly getScenarioDescription: Locator;

  readonly getScenarioInfraName: Locator;

  readonly getResultPathfindingDistance: Locator;

  readonly getInfraLoadState: Locator;

  readonly getTrainCountInput: Locator;

  readonly getDeltaInput: Locator;

  readonly getAddTrainScheduleBtn: Locator;

  readonly getTrainScheduleNameInput: Locator;

  readonly getTrainTimetable: Locator;

  readonly getReturnSimulationResultBtn: Locator;

  readonly getToastSNCF: Locator;

  readonly getToastSNCFTitle: Locator;

  readonly getPathfindingState: Locator;

  readonly getTimetableList: Locator;

  readonly getTrainEditBtn: Locator;

  readonly getAllowancesSelector: Locator;

  readonly getAllowancesModule: Locator;

  readonly getAllowancesStandardSettings: Locator;

  readonly getAllowancesEnergyConsumed: Locator;

  readonly getAverageEnergyConsumed: Locator;

  readonly getAllowancesEngineeringSettings: Locator;

  readonly getAllowancesEngineeringBtn: Locator;

  readonly getSuccessBtn: Locator;

  constructor(readonly page: Page) {
    this.getRollingStockSelector = page.getByTestId('rollingstock-selector-minicard');
    this.getScenarioUpdateBtn = page.getByTitle('Modifier le scénario');
    this.getScenarioDeleteConfirmBtn = page
      .locator('#modal-content')
      .getByText('Supprimer', { exact: true });
    this.getScenarioTags = page.locator('.scenario-card-tags');
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
    this.getAddScenarioBtn = page.getByTestId('addScenario');
    this.getScenarioNameInput = page.locator('#scenarioInputName');
    this.getScenarioDescriptionInput = page.locator('#scenarioDescription');
    this.getScenarioInfraList = page.getByTestId('infraslist');
    this.getScenarioElectricProfileSelect = page.locator('.input-group');
    this.getScenarioName = page.locator('.scenario-details-name .scenario-name');
    this.getScenarioDescription = page.locator('.scenario-details-description');
    this.getScenarioInfraName = page.locator('.scenario-infra-name');
    this.getResultPathfindingDistance = page.getByTestId('result-pathfinding-distance');
    this.getInfraLoadState = page.locator('.infra-loading-state');
    this.getTrainCountInput = page.locator('#osrdconf-traincount');
    this.getDeltaInput = page.locator('#osrdconf-delta');
    this.getAddTrainScheduleBtn = page.getByTestId('add-train-schedules');
    this.getTrainScheduleNameInput = page.locator('#trainSchedule-name');
    this.getTrainTimetable = page
      .locator('.scenario-timetable-trains')
      .locator('.scenario-timetable-train');
    this.getReturnSimulationResultBtn = page.getByTestId('return-simulation-result');
    this.getToastSNCF = page.getByTestId('toast-SNCF');
    this.getToastSNCFTitle = this.getToastSNCF.getByTestId('toast-SNCF-title');
    this.getPathfindingState = page.locator('.pathfinding-state-main-container');
    this.getTimetableList = page.locator('.scenario-timetable-train-with-right-bar');
    this.getTrainEditBtn = page.locator('.scenario-timetable-train-buttons-update');
    this.getAllowancesSelector = page.getByTestId('allowances');
    this.getAllowancesModule = page.locator('.operational-studies-allowances');
    this.getAllowancesStandardSettings = page
      .getByTestId('standard-allowance-group')
      .getByTestId('input-group-first-field');
    this.getAllowancesEnergyConsumed = page.getByTestId('allowance-energy-consumed');
    this.getAverageEnergyConsumed = page.getByTestId('average-energy-consumed');
    this.getAllowancesEngineeringSettings = page
      .getByTestId('engineering-allowance-group')
      .getByTestId('input-group-first-field');
    this.getAllowancesEngineeringBtn = page.getByTestId('engineering-allowance');
    this.getSuccessBtn = page
      .locator('div')
      .filter({ hasText: /^●Linéaire●Mareco s%min\/100kms$/ })
      .getByRole('button')
      .nth(1);
    this.getScenarioUpdateConfirmBtn = page.locator('#modal-content').getByTestId('updateScenario');
  }

  async openTabByText(text: string) {
    await this.page.locator('span', { hasText: text }).click();
  }

  getScenarioByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  async openScenarioByTestId(scenarioTestId: string) {
    await this.page.getByTestId(scenarioTestId).getByTestId('openScenario').first().click();
  }

  async openScenarioCreationModal() {
    await this.getAddScenarioBtn.click();
  }

  async setScenarioName(name: string) {
    await this.getScenarioNameInput.fill(name);
  }

  async openScenarioModalUpdate() {
    await this.getScenarioUpdateBtn.click();
  }

  async setScenarioDescription(description: string) {
    await this.getScenarioDescriptionInput.fill(description);
  }

  async setScenarioInfraByName(infraName: string) {
    await this.getScenarioInfraList.getByText(infraName).first().click();
  }

  async setScenarioElectricProfileByName(electricProfileName: string) {
    await this.getScenarioElectricProfileSelect.click();
    await this.page.locator('[id="-selecttoggle"]').getByText(electricProfileName).click();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await this.page.waitForSelector('[data-testid="result-pathfinding-distance"]');
    await expect(this.getResultPathfindingDistance).toHaveText(distance);
  }

  async checkInfraLoaded() {
    await this.page.waitForSelector('.cached');
    await expect(this.getInfraLoadState).toHaveClass(/cached/);
  }

  async setNumberOfTrains(digits: string) {
    const splittedDigit = digits.split('');
    await this.getTrainCountInput.focus();
    await this.page.keyboard.press('Backspace');
    splittedDigit.forEach(async (digit) => {
      await this.page.keyboard.press(digit);
    });
  }

  async setDelta(digits: string) {
    const splittedDigit = digits.split('');
    await this.getDeltaInput.focus();
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.press('Backspace');
    splittedDigit.forEach(async (digit) => {
      await this.page.keyboard.press(digit);
    });
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

  getBtnByName(name: string | RegExp) {
    return this.page.getByRole('button', { name });
  }

  async checkPathfingingStateText(text: string | RegExp) {
    await expect(this.getPathfindingState).toHaveText(text);
  }

  async clickBtnByName(name: string) {
    await this.getBtnByName(name).click();
  }

  async openAllowancesModule() {
    await this.getAllowancesSelector.click();
  }

  async setStandardAllowance() {
    await this.getAllowancesStandardSettings.focus();
    await this.page.keyboard.press('Digit5');
  }

  async checkAllowanceEnergyConsumed() {
    const content = await this.getAllowancesEnergyConsumed.textContent();
    const allowancesEnergyNumber = Number((content as string).slice(4, -3));
    return allowancesEnergyNumber;
  }

  async checkAverageEnergyConsumed() {
    const content = await this.getAverageEnergyConsumed.textContent();
    const averageEnergyNumber = Number((content as string).slice(0, -3));
    return averageEnergyNumber;
  }

  async isAllowanceWorking() {
    const allowancesEnergyConsumed = await this.checkAllowanceEnergyConsumed();
    const averageEnergyConsumed = await this.checkAverageEnergyConsumed();

    const isCurrentAllowanceWorking = allowancesEnergyConsumed < averageEnergyConsumed;
    return isCurrentAllowanceWorking;
  }

  async setEngineeringAllowance() {
    await this.getAllowancesEngineeringSettings.focus();
    await this.page.keyboard.press('Digit1');
    await this.page.keyboard.press('Digit8');
    await this.page.keyboard.press('Digit0');
  }

  async checkAllowanceEngineeringBtn() {
    await expect(this.getAllowancesEngineeringBtn).toBeVisible();
  }

  async clickSuccessBtn() {
    await this.getSuccessBtn.click();
  }

  async clickScenarioUpdateConfirmBtn() {
    await this.getScenarioUpdateConfirmBtn.click();
  }

  async clickScenarioDeleteConfirmBtn() {
    await this.getScenarioDeleteConfirmBtn.click();
  }
}

export default PlaywrightScenarioPage;
