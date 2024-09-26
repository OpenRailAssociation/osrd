import { type Locator, type Page, expect } from '@playwright/test';

import BasePage from './base-page';
import manageTrainScheduleTranslation from '../../public/locales/fr/operationalStudies/manageTrainSchedule.json';

const trainAddedTranslation = manageTrainScheduleTranslation.trainAdded;

// TODO: extends simulation-conf-page
class ScenarioPage extends BasePage {
  readonly getScenarioUpdateBtn: Locator;

  readonly getScenarioDeleteConfirmBtn: Locator;

  readonly getRollingStockSelector: Locator;

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

  readonly getPathfindingState: Locator;

  readonly getSearchByTrigramButton: Locator;

  readonly getSearchByTrigramContainer: Locator;

  readonly getSearchByTrigramInput: Locator;

  readonly getSearchByTrigramsubmit: Locator;

  readonly getResultPathfindingDone: Locator;

  readonly getTimetableList: Locator;

  readonly getTrainEditBtn: Locator;

  readonly getAllowancesSelector: Locator;

  readonly getAllowancesModule: Locator;

  readonly getAllowancesStandardSettings: Locator;

  readonly getAllowancesEnergyConsumed: Locator;

  readonly getAverageEnergyConsumed: Locator;

  readonly getAllowancesEngineeringSettings: Locator;

  readonly getSuccessBtn: Locator;

  constructor(readonly page: Page) {
    super(page);

    this.getRollingStockSelector = page.getByTestId('rollingstock-selector-empty');
    this.getScenarioUpdateBtn = page.getByTitle('Modifier le scénario');
    this.getScenarioDeleteConfirmBtn = page
      .locator('#modal-content')
      .getByText('Supprimer', { exact: true });
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
    this.getSearchByTrigramButton = page.getByTestId('rocket-button');
    this.getSearchByTrigramContainer = page.getByTestId('type-and-path-container');
    this.getSearchByTrigramInput = page.getByTestId('type-and-path-input');
    this.getSearchByTrigramsubmit = page.getByTestId('submit-search-by-trigram');
    this.getResultPathfindingDone = page.getByTestId('result-pathfinding-done');
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
    this.getPathfindingState = page.locator('.pathfinding-state-main-container');
    this.getTimetableList = page.locator('.scenario-timetable-train-with-right-bar');
    this.getTrainEditBtn = page.locator('.scenario-timetable-train-buttons-update');
    this.getAllowancesSelector = page.getByTestId('allowances');
    this.getAllowancesModule = page.locator('.operational-studies-allowances');
    this.getAllowancesStandardSettings = page
      .getByTestId('standard-allowance-group')
      .getByTestId('allowances-standard-settings-value-input');
    this.getAllowancesEnergyConsumed = page.getByTestId('allowance-energy-consumed');
    this.getAverageEnergyConsumed = page.getByTestId('average-energy-consumed');
    this.getAllowancesEngineeringSettings = page
      .getByTestId('engineering-allowance-group')
      .last()
      .getByTestId('allowances-engineering-allowance-input');
    this.getSuccessBtn = page.getByTestId('add-allowance-button');
    this.getScenarioUpdateConfirmBtn = page.locator('#modal-content').getByTestId('updateScenario');
  }

  async openTabByDataId(id: string) {
    await this.page.getByTestId(id).click();
  }

  getScenarioByName(name: string) {
    return this.page.locator(`text=${name}`);
  }

  getScenarioTags(id: string) {
    return this.page.getByTestId(`scenario-card-${id}`).locator('.scenario-card-tags');
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
    const splitDigit = digits.split('');
    await this.getTrainCountInput.focus();
    await this.page.keyboard.press('Backspace');
    splitDigit.forEach(async (digit) => {
      await this.page.keyboard.press(digit);
    });
  }

  async setDelta(digits: string) {
    const splitDigit = digits.split('');
    await this.getDeltaInput.focus();
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.press('Backspace');
    splitDigit.forEach(async (digit) => {
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

  async checkTrainHasBeenAdded() {
    this.checkLastToastTitle(trainAddedTranslation);
  }

  getBtnByName(name: string | RegExp) {
    return this.page.getByRole('button', { name });
  }

  async checkPathfingingStateText(text: string | RegExp) {
    await expect(this.getPathfindingState).toHaveText(text);
  }

  async getPathfindingByTriGramSearch(firstTrigram: string, secondTrigram: string) {
    await this.getSearchByTrigramButton.click();
    await expect(this.getSearchByTrigramContainer).toBeVisible();
    await this.getSearchByTrigramInput.fill(`${firstTrigram} ${secondTrigram}`);
    await expect(
      this.page.getByTestId(`typeandpath-op-${firstTrigram}`) &&
        this.page.getByTestId(`typeandpath-op-${secondTrigram}`)
    ).toBeVisible();
    await this.getSearchByTrigramsubmit.click();
    await expect(this.getResultPathfindingDone).toBeVisible();
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

export default ScenarioPage;
