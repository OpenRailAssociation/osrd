import { expect, type Locator, type Page } from '@playwright/test';

import { STDCM_SIMULATION_TIMEOUT } from '../../assets/constants/timeout-const';
import HomePage from '../home-page';

class STDCMPage extends HomePage {
  readonly consistCard: Locator;

  readonly originCard: Locator;

  readonly destinationCard: Locator;

  readonly anteriorLinkedTrainContainer: Locator;

  readonly anteriorAddLinkedPathButton: Locator;

  readonly posteriorLinkedTrainContainer: Locator;

  readonly posteriorAddLinkedPathButton: Locator;

  readonly addViaButton: Locator;

  readonly closeTimePickerButton: Locator;

  readonly warningBox: Locator;

  readonly incrementButton: Locator;

  private readonly debugButton: Locator;

  private readonly notificationHeader: Locator;

  private readonly mapContainer: Locator;

  private readonly launchSimulationButton: Locator;

  private readonly closeTolerancePickerButton: Locator;

  readonly suggestionList: Locator;

  private readonly suggestionItems: Locator;

  private readonly simulationStatus: Locator;

  private readonly originMarker: Locator;

  private readonly destinationMarker: Locator;

  private readonly viaMarker: Locator;

  private readonly helpButton: Locator;

  constructor(page: Page) {
    super(page);
    this.notificationHeader = page.locator('#notification');
    this.debugButton = page.getByTestId('stdcm-debug-button');
    this.helpButton = page.getByTestId('stdcm-help-button');
    this.mapContainer = page.locator('#stdcm-map-config');
    this.consistCard = page.locator('.stdcm-consist-container .stdcm-card');
    this.originCard = page.locator('.stdcm-card:has(.stdcm-origin-icon)');
    this.destinationCard = page.locator('.stdcm-card:has(.stdcm-destination-icon)');
    this.addViaButton = page.locator('.stdcm-vias-list button .stdcm-card__body.add-via');
    this.anteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.anterior-linked-train'
    );
    this.anteriorAddLinkedPathButton =
      this.anteriorLinkedTrainContainer.locator('.add-linked-train');
    this.posteriorLinkedTrainContainer = page.locator(
      '.stdcm-linked-train-search-container.posterior-linked-train'
    );
    this.posteriorAddLinkedPathButton =
      this.posteriorLinkedTrainContainer.locator('.add-linked-train');
    this.launchSimulationButton = page.getByTestId('launch-simulation-button');

    this.closeTolerancePickerButton = page.locator('.tolerance-picker .close-button');

    this.suggestionList = page.locator('.suggestions-list');
    this.suggestionItems = this.suggestionList.locator('.suggestion-item');

    this.simulationStatus = page.getByTestId('simulation-status');

    this.originMarker = this.mapContainer.locator('img[alt="origin"]');
    this.destinationMarker = this.mapContainer.locator('img[alt="destination"]');
    this.viaMarker = this.mapContainer.locator('img[alt="via"]');

    this.closeTimePickerButton = page.locator('.time-picker .close-button');
    this.warningBox = page.getByTestId('warning-box');
    this.incrementButton = page.locator('.minute-button', { hasText: '+1mn' });
  }

  async verifySuggestions(expectedSuggestions: string[]) {
    await expect(this.suggestionList).toBeVisible();
    expect(await this.suggestionItems.count()).toBe(expectedSuggestions.length);
    const actualSuggestions = await this.suggestionItems.allTextContents();
    expect(actualSuggestions).toEqual(expectedSuggestions);
  }

  // Verify STDCM elements are visible
  async verifyStdcmElementsVisibility() {
    const elements = [
      this.debugButton,
      this.helpButton,
      this.notificationHeader,
      this.consistCard,
      this.originCard,
      this.addViaButton,
      this.anteriorAddLinkedPathButton,
      this.destinationCard,
      this.posteriorAddLinkedPathButton,
      this.mapContainer,
      this.launchSimulationButton,
    ];
    for (const element of elements) {
      await expect(element).toBeVisible();
    }
  }

  async fillToleranceField(toleranceLocator: Locator, minusValue: string, plusValue: string) {
    await toleranceLocator.click();
    await this.page.getByRole('button', { name: minusValue, exact: true }).click();
    await this.page.getByRole('button', { name: plusValue, exact: true }).click();
    await expect(toleranceLocator).toHaveValue(`${minusValue}/${plusValue}`);
    await this.closeTolerancePickerButton.click();
  }

  // Launch the simulation and check if simulation-related elements are visible
  async launchSimulation(): Promise<void> {
    await this.launchSimulationButton.waitFor();
    await expect(this.launchSimulationButton).toBeEnabled();
    await this.launchSimulationButton.click({ force: true });
  }

  async verifyValidSimulationLaunch(): Promise<void> {
    await this.launchSimulation();
    await this.simulationStatus.waitFor({ timeout: STDCM_SIMULATION_TIMEOUT });
  }

  async verifyInvalidSimulationLaunch(): Promise<void> {
    await this.launchSimulation();
    await expect(this.simulationStatus).not.toBeVisible();
  }

  async mapMarkerVisibility() {
    await expect(this.originMarker).toBeVisible();
    await expect(this.destinationMarker).toBeVisible();
    await expect(this.viaMarker).toBeVisible();
  }

  async expectWarningBoxVisible() {
    await expect(this.warningBox).toBeVisible();
  }

  async expectWarningBoxHidden() {
    await expect(this.warningBox).toBeHidden();
  }

  async expectWarningBoxContains(expectedFields: string[], absentFields?: string[]) {
    for (const field of expectedFields) {
      await expect(this.warningBox).toContainText(new RegExp(field, 'i'));
    }

    if (absentFields) {
      for (const field of absentFields) {
        await expect(this.warningBox).not.toContainText(new RegExp(field, 'i'));
      }
    }
  }
}

export default STDCMPage;
