import { expect, type Locator, type Page } from '@playwright/test';

import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';
import HomePage from '../home-page';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class STDCMPage extends HomePage {
  private readonly consistCard: Locator;

  readonly originCard: Locator;

  readonly destinationCard: Locator;

  readonly anteriorLinkedTrainContainer: Locator;

  readonly anteriorAddLinkedPathButton: Locator;

  readonly posteriorLinkedTrainContainer: Locator;

  readonly posteriorAddLinkedPathButton: Locator;

  readonly addViaButton: Locator;

  readonly warningBox: Locator;

  private readonly debugButton: Locator;

  private readonly mapContainer: Locator;

  readonly launchSimulationButton: Locator;

  private readonly closeOriginTolerancePickerButton: Locator;

  private readonly closeDestinationTolerancePickerButton;

  private readonly suggestionList: Locator;

  readonly suggestionItems: Locator;

  private readonly simulationStatus: Locator;

  private readonly originMarker: Locator;

  private readonly destinationMarker: Locator;

  private readonly viaMarker: Locator;

  private readonly helpButton: Locator;

  private readonly pathfindingStatusMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.debugButton = page.getByTestId('stdcm-debug-button');
    this.helpButton = page.getByTestId('stdcm-help-button');
    this.mapContainer = page.locator('#stdcm-map-config');
    this.consistCard = page.getByTestId('consist-card-body');
    this.originCard = page.getByTestId('stdcm-card-origin');
    this.destinationCard = page.getByTestId('stdcm-card-destination');
    this.addViaButton = page.getByTestId('add-via-card-body');
    this.anteriorLinkedTrainContainer = page.getByTestId('anterior-container');
    this.anteriorAddLinkedPathButton = this.anteriorLinkedTrainContainer.getByTestId(
      'add-linked-train-card-body'
    );
    this.posteriorLinkedTrainContainer = page.getByTestId('posterior-container');
    this.posteriorAddLinkedPathButton = this.posteriorLinkedTrainContainer.getByTestId(
      'add-linked-train-card-body'
    );
    this.launchSimulationButton = page.getByTestId('launch-simulation-button');

    this.closeOriginTolerancePickerButton = page
      .getByTestId('tolerance-origin-arrival')
      .getByTestId('modal-close-button');
    this.closeDestinationTolerancePickerButton = page
      .getByTestId('tolerance-destination-arrival')
      .getByTestId('modal-close-button');

    this.suggestionList = page.getByTestId('suggestions-list');
    this.suggestionItems = this.suggestionList.getByTestId('suggestions-item');

    this.simulationStatus = page.getByTestId('simulation-status');

    this.originMarker = this.mapContainer.locator('img[alt="origin"]');
    this.destinationMarker = this.mapContainer.locator('img[alt="destination"]');
    this.viaMarker = this.mapContainer.locator('img[alt="via"]');

    this.warningBox = page.getByTestId('warning-box');

    this.pathfindingStatusMessage = page.getByTestId('pathfinding-status-message');
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

  async fillToleranceField({
    toleranceInput,
    minusValue,
    plusValue,
    toleranceOp,
  }: {
    toleranceInput: Locator;
    minusValue: string;
    plusValue: string;
    toleranceOp: 'origin' | 'destination';
  }): Promise<void> {
    await toleranceInput.click();

    const minusButton = this.page.getByRole('button', { name: minusValue, exact: true });
    const plusButton = this.page.getByRole('button', { name: plusValue, exact: true });

    await minusButton.click();
    await plusButton.click();

    await expect(toleranceInput).toHaveValue(`${minusValue}/${plusValue}`);

    const closeButton =
      toleranceOp === 'origin'
        ? this.closeOriginTolerancePickerButton
        : this.closeDestinationTolerancePickerButton;

    await closeButton.click();
  }

  // Launch the simulation and check if simulation-related elements are visible
  private async launchSimulation(): Promise<void> {
    await expect(this.pathfindingStatusMessage).toBeHidden();
    await expect(this.launchSimulationButton).toBeVisible();
    await expect(this.launchSimulationButton).toBeEnabled();
    await this.launchSimulationButton.click({ force: true });
  }

  async verifyValidSimulationLaunch(): Promise<void> {
    await this.launchSimulation();
    expect(await this.simulationStatus.textContent()).toEqual(
      frTranslations.simulation.results.status.completed
    );
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
