import { type Locator, type Page, expect } from '@playwright/test';

import type {
  ChangeGroup,
  OccurrenceDetails,
  OccurrenceMenuButton,
  PacedTrainDetails,
  PacedTrainOptions,
  TimetableFilterTranslations,
} from '../../utils/types';
import ScenarioTimetableSection from './scenario-timetable-section';

class PacedTrainSection extends ScenarioTimetableSection {
  private readonly pacedTrainItem: Locator;
  private readonly testedPacedTrain: Locator;
  private readonly testedPacedTrainShowOccurrencesButton: Locator;
  private readonly testedPacedTrainName: Locator;
  private readonly testedPacedTrainRollingStock: Locator;
  private readonly testedPacedTrainInterval: Locator;
  private readonly testedPacedTrainOccurrences: Locator;
  private readonly testedOccurrenceName: Locator;
  private readonly testedOccurrenceStartTime: Locator;
  private readonly testedOccurrenceArrivalTime: Locator;
  private readonly testedOccurrenceArrivalTimeLoader: Locator;
  private readonly occurrencesCount: Locator;
  private readonly manageTrainSchedulePage: Locator;
  private readonly confirmationModalButton: Locator;
  private readonly portalOccurrenceMenu: {
    disable: Locator;
    enable: Locator;
    edit: Locator;
    restore: Locator;
    project: Locator;
    delete: Locator;
  };
  readonly closeItineraryModalButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pacedTrainItem = page.getByTestId('paced-train');
    this.testedPacedTrain = page.locator('.paced-train:not(.closed)');
    this.testedPacedTrainShowOccurrencesButton =
      this.testedPacedTrain.getByTestId('show-occurrences-button');
    this.testedPacedTrainName = this.testedPacedTrain.getByTestId('paced-train-name');
    this.testedPacedTrainRollingStock = this.testedPacedTrain
      .getByTestId('paced-train')
      .getByTestId('rolling-stock');
    this.testedPacedTrainInterval = this.testedPacedTrain.getByTestId('paced-train-interval');
    this.testedPacedTrainOccurrences = this.testedPacedTrain.getByTestId('occurrence-item');
    this.testedOccurrenceName = this.testedPacedTrain.getByTestId('occurrence-item-name');
    this.testedOccurrenceStartTime = this.testedPacedTrain.getByTestId('departure-time');
    this.testedOccurrenceArrivalTime = this.testedPacedTrain.getByTestId('arrival-time');
    this.testedOccurrenceArrivalTimeLoader =
      this.testedPacedTrain.getByTestId('arrival-time-loader');
    this.occurrencesCount = page.getByTestId('occurrences-count');
    this.manageTrainSchedulePage = page.getByTestId('manage-train-schedule');
    this.confirmationModalButton = page.getByTestId('confirmation-modal-button');
    this.portalOccurrenceMenu = {
      disable: page.getByTestId('occurrence-disable-button'),
      enable: page.getByTestId('occurrence-enable-button'),
      edit: page.getByTestId('occurrence-edit-button'),
      restore: page.getByTestId('occurrence-restore-button'),
      project: page.getByTestId('occurrence-project-button'),
      delete: page.getByTestId('occurrence-delete-button'),
    };
    this.closeItineraryModalButton = page.getByTestId('close-itinerary-modal');
  }

  private getNthOccurrence(index: number) {
    const root = this.testedPacedTrainOccurrences.nth(index);
    return {
      root,
      indicator: root.getByTestId('occurrence-indicator'),
      tooltip: root.getByTestId('osrd-tooltip'),
      image: root.getByTestId('rolling-stock-image'),
      menuIcon: root.getByTestId('occurrence-item-menu-btn'),
    };
  }

  private expandPacedTrainToggleIcon(index: number): Locator {
    return this.pacedTrainItem.nth(index).getByTestId('toggle-icon-open');
  }

  private collapsePacedTrainToggleIcon(index: number): Locator {
    return this.pacedTrainItem.nth(index).getByTestId('toggle-icon-close');
  }

  private selectedPacedTrainArea(index: number): Locator {
    return this.pacedTrainItem.nth(index).getByTestId('selected-paced-train-area');
  }

  async expandPacedTrainOccurrenceList(index: number) {
    await this.expandPacedTrainToggleIcon(index).click();
  }

  async collapsePacedTrainOccurrenceList(index: number) {
    await this.collapsePacedTrainToggleIcon(index).click();
  }

  async ensurePacedTrainOccurrenceListOpen(index: number) {
    if ((await this.testedPacedTrainOccurrences.count()) === 0) {
      await this.expandPacedTrainOccurrenceList(index);
    }
    await expect(this.testedPacedTrainOccurrences.first()).toBeVisible();
  }

  async verifyPacedTrainItemDetails(
    pacedTrainData: PacedTrainDetails,
    index: number,
    options: PacedTrainOptions = {}
  ) {
    const {
      copyTranslation,
      occurrenceData,
      pacedTrainCardAlreadyOpen = false,
      occurrenceColor,
    } = options;

    const { name, labels, interval, expectedOccurrencesCount } = pacedTrainData;

    // In paced_trains.json, invalid paced trains are marked with an `Invalid` label
    // An invalid paced train won't have any details
    if (labels?.includes('Invalid')) return;

    if (!pacedTrainCardAlreadyOpen) await this.expandPacedTrainOccurrenceList(index);

    await expect(this.testedPacedTrainShowOccurrencesButton).not.toBeVisible();
    await expect(this.testedPacedTrainOccurrences.first()).toBeVisible();

    if (expectedOccurrencesCount !== undefined) {
      await expect(this.testedPacedTrainOccurrences).toHaveCount(expectedOccurrencesCount);
      await this.verifyOccurrencesCount(expectedOccurrencesCount, index, occurrenceColor);
    }

    const expectedName = copyTranslation ? `${name} (${copyTranslation})` : name;
    await expect(this.testedPacedTrainName).toBeVisible();
    await expect(this.testedPacedTrainName).toHaveText(expectedName);

    await expect(this.testedPacedTrainInterval).toBeVisible();
    await expect(this.testedPacedTrainInterval).toHaveText(`— ${interval}min`); // UI: "— Xmin"

    // Verify that the pace train item does not display the rolling stock
    await expect(this.testedPacedTrainRollingStock).not.toBeVisible();

    await this.verifyItemsVisibility(index, 'paced-train');

    if (occurrenceData) {
      for (let occurrenceIndex = 0; occurrenceIndex < occurrenceData.length; occurrenceIndex += 1) {
        await this.verifyOccurrenceDetails(occurrenceData[occurrenceIndex], occurrenceIndex, {
          copyTranslation,
        });
      }
    }
    await this.collapsePacedTrainOccurrenceList(index);
  }

  async verifyPacedTrainSelected(pacedTrainIndex: number) {
    await expect(this.pacedTrainItem.nth(pacedTrainIndex)).toHaveClass(/selected/);
  }

  async verifyOccurrencesCount(
    expectedOccurrencesCount: number,
    index: number,
    occurrenceColor?: string
  ) {
    const pacedTrainOccurrencesCount = this.occurrencesCount.nth(index);
    await expect(pacedTrainOccurrencesCount).toHaveText(String(expectedOccurrencesCount));

    if (occurrenceColor) {
      await expect(pacedTrainOccurrencesCount).toHaveCSS('background-color', occurrenceColor);
    }
  }

  async verifyOccurrenceName(
    occurrenceIndex: number,
    expectedName: string,
    duplicate?: { copyTranslation?: string }
  ) {
    const occurrenceNameLocator = this.testedOccurrenceName.nth(occurrenceIndex);
    if (duplicate?.copyTranslation) {
      // duplicated train name should have format : "name (copy) and start with suffix 1 then 3, 5..."
      expectedName = `${expectedName} (${duplicate.copyTranslation}) ${occurrenceIndex * 2 + 1}`;
    }
    await expect(occurrenceNameLocator).toHaveText(expectedName);
  }

  private async verifyOccurrenceStartTime(occurrenceIndex: number, expectedStartTime: string) {
    const occurrenceStartTimeLocator = this.testedOccurrenceStartTime.nth(occurrenceIndex);
    await expect(occurrenceStartTimeLocator).toHaveText(expectedStartTime);
  }

  private async verifyOccurrenceArrivalTime(occurrenceIndex: number, expectedArrivalTime: string) {
    const occurrenceArrivalTimeLoader = this.testedOccurrenceArrivalTimeLoader.nth(occurrenceIndex);
    const occurrenceArrivalTimeLocator = this.testedOccurrenceArrivalTime.nth(occurrenceIndex);
    await expect(occurrenceArrivalTimeLoader).toBeHidden();
    await expect(occurrenceArrivalTimeLocator).toHaveText(expectedArrivalTime, { timeout: 30_000 });
  }

  async verifyOccurrenceArrivalTimes(expectedArrivalTimes: string[]) {
    for (const [occurrenceIndex, arrivalTime] of expectedArrivalTimes.entries()) {
      await this.verifyOccurrenceArrivalTime(occurrenceIndex, arrivalTime);
    }
  }

  async getActionButtonsLocators({
    trainIndex,
    trainType,
    withExceptions = false,
    checkVisibility = false,
  }: {
    trainIndex: number;
    trainType: 'paced-train' | 'occurrence';
    withExceptions?: boolean;
    checkVisibility?: boolean;
  }): Promise<Record<string, Locator>> {
    const isPacedTrain = trainType === 'paced-train';

    const train = isPacedTrain
      ? this.pacedTrainItem.nth(trainIndex)
      : this.testedPacedTrainOccurrences.nth(trainIndex);
    await expect(train).toBeVisible();
    await train.scrollIntoViewIfNeeded();
    await train.hover({ position: { x: 5, y: 5 } });

    const actionButtons: Record<string, Locator> = {
      projectTrain: train.getByTestId('project-train'),
      duplicateTrain: train.getByTestId('duplicate-train'),
      editTrain: train.getByTestId('edit-train'),
      deleteTrain: train.getByTestId('delete-train'),
    };

    if (isPacedTrain && withExceptions) {
      actionButtons.resetExceptions = train.getByTestId('reset-exceptions');
    }

    if (checkVisibility) {
      for (const locator of Object.values(actionButtons)) {
        await expect(locator).toBeVisible();
      }
    }

    return actionButtons;
  }

  private async verifyItemsVisibility(
    trainIndex: number,
    trainType: 'paced-train' | 'occurrence'
  ): Promise<void> {
    const actionButtonsLocators = await this.getActionButtonsLocators({ trainIndex, trainType });

    // Actions buttons should be visible when hovering a paced train but not for an occurrence
    await Promise.all(
      Object.values(actionButtonsLocators).map((locator) =>
        trainType === 'paced-train'
          ? expect(locator).toBeVisible()
          : expect(locator).not.toBeVisible()
      )
    );
  }

  public async verifyOccurrenceDetails(
    occurrenceData: OccurrenceDetails,
    occurrenceIndex: number,
    duplicate?: {
      copyTranslation?: string;
    }
  ) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.root).toBeVisible();
    await this.verifyOccurrenceName(occurrenceIndex, occurrenceData.name, {
      copyTranslation: duplicate?.copyTranslation,
    });

    await this.verifyOccurrenceStartTime(occurrenceIndex, occurrenceData.startTime);
    await this.verifyOccurrenceArrivalTime(occurrenceIndex, occurrenceData.arrivalTime);

    await expect(occurrenceItem.image).toBeVisible();

    await this.verifyItemsVisibility(occurrenceIndex, 'occurrence');
  }

  async selectOccurrence({
    pacedTrainIndex,
    occurrenceIndex,
  }: {
    pacedTrainIndex: number;
    occurrenceIndex: number;
  }) {
    await this.expandPacedTrainOccurrenceList(pacedTrainIndex);
    const occurrenceItem = this.testedPacedTrainOccurrences.nth(occurrenceIndex);
    await occurrenceItem.click();
    await this.collapsePacedTrainOccurrenceList(pacedTrainIndex);
  }

  async selectPacedTrainModel(index = 0) {
    const nameArea = this.selectedPacedTrainArea(index);
    const pacedTrain = this.pacedTrainItem.nth(index);
    await expect(nameArea).toBeVisible();
    const classAttribute = await pacedTrain.getAttribute('class');
    const isAlreadySelected = classAttribute?.split(' ').includes('selected') ?? false;
    if (isAlreadySelected) return;
    await expect(async () => {
      await nameArea.click();
      await expect(pacedTrain).toHaveClass(/selected/);
    }).toPass();
  }

  async duplicatePacedTrain(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await actionButtons.duplicateTrain.click();
    await this.collapsePacedTrainOccurrenceList(index);
  }

  async openPacedTrainEditor(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await expect(actionButtons.editTrain).toBeVisible();
    await actionButtons.editTrain.click();
    // TODO: This function must be modified after we drop the old itinerary interface
    await this.closeItineraryModalButton.click();
    await expect(this.manageTrainSchedulePage).toBeVisible();
  }

  async projectPacedTrain(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await expect(actionButtons.projectTrain).toBeVisible();
    await actionButtons.projectTrain.click();
  }

  async deletePacedTrain(
    index: number,
    translations: TimetableFilterTranslations,
    pacedTrainData?: PacedTrainDetails
  ) {
    const trainScheduleToDelete = this.pacedTrainItem.nth(index);
    const pacedTrainActionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await pacedTrainActionButtons.deleteTrain.click();

    await expect(this.confirmationModalDeleteButton).toBeVisible();
    await this.confirmationModalDeleteButton.click();

    if (pacedTrainData) {
      const { name } = pacedTrainData;

      await this.verifyPacedTrainHasBeenDeleted(name, translations);

      await expect(trainScheduleToDelete).not.toHaveText(name);
    }
  }

  private async verifyPacedTrainHasBeenDeleted(
    deletedPacedTrainName: string,
    translations: TimetableFilterTranslations
  ) {
    const duplicatedPacedTrainName = `${deletedPacedTrainName} (${translations.timetable.copy})`;
    // Translation has format 'The service {{name}} has been deleted';
    const [firstPart, secondPart] = translations.timetable.pacedTrainDeleted.split('{{name}}');
    const expectedDeleteToast = `${firstPart}${duplicatedPacedTrainName}${secondPart}`;
    await this.checkToastTitle(expectedDeleteToast);
  }

  async checkExceptionTooltip(
    occurrenceIndex: number,
    title: string,
    ...changeGroups: ChangeGroup[]
  ) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.indicator).toBeVisible();
    await occurrenceItem.indicator.hover();

    const expectedExceptionText = title + changeGroups.join('');
    await expect(occurrenceItem.tooltip).toBeVisible();
    await expect(occurrenceItem.tooltip).toHaveText(expectedExceptionText);

    // Move away so it doesn't linger into the next check
    await this.page.mouse.move(0, 0);
    await expect(occurrenceItem.tooltip).not.toBeVisible();
  }

  async checkOccurrenceMenuIcon(occurrenceIndex: number) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.root).toBeVisible();
    // Force a fresh hover transition so the CSS `:hover` rule revealing the menu button reliably triggers
    await this.page.mouse.move(0, 0);
    await occurrenceItem.root.hover();
    await expect(occurrenceItem.menuIcon).toBeVisible();
  }

  async openOccurrenceActionMenu(occurrenceIndex: number, pacedTrainIndex = 0) {
    await this.page.keyboard.press('Escape');
    await this.ensurePacedTrainOccurrenceListOpen(pacedTrainIndex);
    await this.checkOccurrenceMenuIcon(occurrenceIndex);
    await this.getNthOccurrence(occurrenceIndex).menuIcon.click();
  }

  async clickOnOccurrence(occurrenceIndex: number) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.root).toBeVisible();
    await occurrenceItem.root.click();
  }

  async checkOccurrenceActionMenu({
    occurrenceIndex,
    expectedButtons,
    translations,
    pacedTrainIndex = 0,
  }: {
    occurrenceIndex: number;
    expectedButtons: OccurrenceMenuButton[];
    translations: TimetableFilterTranslations;
    pacedTrainIndex?: number;
  }) {
    await this.openOccurrenceActionMenu(occurrenceIndex, pacedTrainIndex);
    for (const buttonName of expectedButtons) {
      const button = this.portalOccurrenceMenu[buttonName];
      await expect(button).toBeVisible();
      await expect(button).toHaveText(translations.occurrenceMenu[buttonName]);
    }
  }

  async clickOccurrenceMenuButton(buttonToClick: OccurrenceMenuButton) {
    const portalOccurrenceMenu = this.portalOccurrenceMenu[buttonToClick];
    await expect(portalOccurrenceMenu).toBeVisible();
    await portalOccurrenceMenu.click();
    // TODO: This function must be modified after we drop the old itinerary interface
    if (buttonToClick === 'edit') {
      if (await this.closeItineraryModalButton.isVisible()) {
        await this.closeItineraryModalButton.click(); // Close the itinerary modal if open
      }
    }
  }

  async resetAllPacedTrainExceptions(pacedTrainIndex: number) {
    const { resetExceptions } = await this.getActionButtonsLocators({
      trainIndex: pacedTrainIndex,
      trainType: 'paced-train',
      withExceptions: true,
    });

    await expect(resetExceptions).toBeVisible();
    await resetExceptions.click();

    await expect(this.confirmationModalButton).toBeVisible();
    await this.confirmationModalButton.click();
  }

  async expectOccurrencesListLength(length: number) {
    await expect(this.testedPacedTrainOccurrences.first()).toBeVisible();
    await expect(this.testedPacedTrainOccurrences).toHaveCount(length);
  }

  // Iterate over each paced train occurrences and verify the visibility of simulation results
  async verifyPacedTrainSimulations(pacedTrainCount: number): Promise<void> {
    for (let pacedTrainIndex = 0; pacedTrainIndex < pacedTrainCount; pacedTrainIndex += 1) {
      const pacedTrain = this.trainSchedules.nth(pacedTrainIndex);
      await expect(pacedTrain).toBeVisible();

      await this.expandPacedTrainOccurrenceList(pacedTrainIndex);

      const occurrences = this.getOccurrences(pacedTrain); // retrieves all occurrence for this mission

      const count = await occurrences.count();
      for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
        const occurrenceButton = occurrences.nth(occurrenceIndex);

        const isSelected =
          (await occurrenceButton.getAttribute('class'))?.includes('selected') ?? false;
        if (!isSelected) {
          await occurrenceButton.click();
        }

        await this.verifySimulationResultsVisibility();
      }

      await this.collapsePacedTrainOccurrenceList(pacedTrainIndex);
    }
  }
}

export default PacedTrainSection;
