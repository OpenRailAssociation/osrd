import { type Locator, type Page, expect } from '@playwright/test';

import type {
  ChangeGroup,
  OccurrenceDetails,
  OccurrenceMenuButton,
  PacedTrainDetails,
  PacedTrainOptions,
  TimetableFilterTranslations,
} from '../../utils/types';
import CommonPage from '../common-page';

class PacedTrainSection extends CommonPage {
  private readonly pacedTrainItem: Locator;
  private readonly selectedPacedTrainArea: Locator;
  private readonly testedPacedTrain: Locator;
  private readonly testedPacedTrainShowOccurrencesButton: Locator;
  private readonly testedPacedTrainName: Locator;
  private readonly testedPacedTrainRollingStock: Locator;
  private readonly testedPacedTrainInterval: Locator;
  private readonly testedPacedTrainOccurrences: Locator;
  private readonly testedOccurrenceName: Locator;
  private readonly testedOccurrenceStartTime: Locator;
  private readonly testedOccurrenceArrivalTime: Locator;
  private readonly occurrencesCount: Locator;
  private readonly manageTrainSchedulePage: Locator;
  private readonly confirmationModalDeleteButton: Locator;
  private readonly confirmationModalButton: Locator;
  private readonly portalOccurrenceMenu: {
    disable: Locator;
    enable: Locator;
    edit: Locator;
    restore: Locator;
    project: Locator;
    delete: Locator;
  };

  constructor(page: Page) {
    super(page);
    this.pacedTrainItem = page.getByTestId('paced-train');
    this.selectedPacedTrainArea = page.getByTestId('selected-paced-train-area');
    this.testedPacedTrain = page.locator('.paced-train:not(.closed)');
    this.testedPacedTrainShowOccurrencesButton =
      this.testedPacedTrain.getByTestId('show-occurrences-button');
    this.testedPacedTrainName = this.testedPacedTrain.getByTestId('paced-train-name');
    this.testedPacedTrainRollingStock = this.testedPacedTrain.locator('> .rolling-stock');
    this.testedPacedTrainInterval = this.testedPacedTrain.getByTestId('paced-train-interval');
    this.testedPacedTrainOccurrences = this.testedPacedTrain.getByTestId('occurrence-item');
    this.testedOccurrenceName = this.testedPacedTrain.getByTestId('occurrence-item-name');
    this.testedOccurrenceStartTime = this.testedPacedTrain.getByTestId('departure-time');
    this.testedOccurrenceArrivalTime = this.testedPacedTrain.getByTestId('arrival-time');
    this.occurrencesCount = page.getByTestId('occurrences-count');
    this.manageTrainSchedulePage = page.getByTestId('manage-train-schedule');
    this.confirmationModalDeleteButton = page.getByTestId('confirmation-modal-delete-button');
    this.confirmationModalButton = page.getByTestId('confirmation-modal-button');
    this.portalOccurrenceMenu = {
      disable: page.getByTestId('occurrence-disable-button'),
      enable: page.getByTestId('occurrence-enable-button'),
      edit: page.getByTestId('occurrence-edit-button'),
      restore: page.getByTestId('occurrence-restore-button'),
      project: page.getByTestId('occurrence-project-button'),
      delete: page.getByTestId('occurrence-delete-button'),
    };
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

  private async expandPacedTrainToggleIcon(index: number) {
    return this.pacedTrainItem.nth(index).getByTestId('toggle-icon-open');
  }

  private async collapsePacedTrainToggleIcon(index: number) {
    return this.pacedTrainItem.nth(index).getByTestId('toggle-icon-close');
  }

  private async selectPacedTrain(pacedTrainIndex: number) {
    await this.selectedPacedTrainArea.nth(pacedTrainIndex).click();
  }

  async expandPacedTrainOccurrenceList(index: number) {
    const expandPacedTrainToggleIcon = await this.expandPacedTrainToggleIcon(index);
    await expect(expandPacedTrainToggleIcon).toBeVisible();
    await expandPacedTrainToggleIcon.click();
  }

  async collapsePacedTrainOccurrenceList(index: number) {
    const collapsePacedTrainToggleIcon = await this.collapsePacedTrainToggleIcon(index);
    await expect(collapsePacedTrainToggleIcon).toBeVisible();
    await collapsePacedTrainToggleIcon.click();
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
    await this.selectPacedTrain(pacedTrainIndex);
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
    const occurrenceArrivalTimeLocator = this.testedOccurrenceArrivalTime.nth(occurrenceIndex);
    await expect(occurrenceArrivalTimeLocator).toHaveText(expectedArrivalTime);
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
    await train.hover({ position: { x: 5, y: 5 } }); // Hover near the left edge to avoid action buttons

    const actionButtons: Record<string, Locator> = {
      projectItem: train.getByTestId('project-train'),
      duplicateItem: train.getByTestId('duplicate-train'),
      editItem: train.getByTestId('edit-train'),
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

  async duplicatePacedTrain(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await actionButtons.duplicateItem.click();
    await this.collapsePacedTrainOccurrenceList(index);
  }

  async openPacedTrainEditor(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await expect(actionButtons.editItem).toBeVisible();
    await actionButtons.editItem.click();
    await expect(this.manageTrainSchedulePage).toBeVisible();
  }

  async projectPacedTrain(index = 0) {
    await this.expandPacedTrainOccurrenceList(index);
    const actionButtons = await this.getActionButtonsLocators({
      trainIndex: index,
      trainType: 'paced-train',
    });
    await expect(actionButtons.projectItem).toBeVisible();
    await actionButtons.projectItem.click();
  }

  async deletePacedTrain(
    index: number,
    translations: TimetableFilterTranslations,
    pacedTrainData?: PacedTrainDetails
  ) {
    const timetableItemToDelete = this.pacedTrainItem.nth(index);
    await timetableItemToDelete.hover({ position: { x: 5, y: 5 } });
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

      await expect(timetableItemToDelete).not.toHaveText(name);
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
  }

  async checkOccurrenceMenuIcon(occurrenceIndex: number) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.root).toBeVisible();
    await occurrenceItem.root.hover();
    await expect(occurrenceItem.menuIcon).toBeVisible();
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
  }: {
    occurrenceIndex: number;
    expectedButtons: OccurrenceMenuButton[];
    translations: TimetableFilterTranslations;
  }) {
    const occurrenceItem = this.getNthOccurrence(occurrenceIndex);
    await expect(occurrenceItem.menuIcon).toBeVisible();
    await occurrenceItem.menuIcon.click();
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
}

export default PacedTrainSection;
