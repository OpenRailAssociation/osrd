import { type Locator, type Page, expect } from '@playwright/test';

import type {
  ChangeGroup,
  OccurrenceDetails,
  OccurrenceMenuButton,
  PacedTrainDetails,
  TimetableFilterTranslations,
} from '../../utils/types';
import CommonPage from '../common-page';

class PacedTrainSection extends CommonPage {
  private readonly pacedTrainItem: Locator;

  private readonly testedPacedTrain: Locator;

  private readonly testedPacedTrainToggleIcon: Locator;

  private readonly testedPacedTrainShowOccurrencesButton: Locator;

  private readonly testedPacedTrainName: Locator;

  private readonly testedPacedTrainRollingStock: Locator;

  private readonly testedPacedTrainInterval: Locator;

  private readonly testedPacedTrainOccurrences: Locator;

  private readonly testedOccurrenceName: Locator;

  private readonly testedOccurrenceStartTime: Locator;

  private readonly testedOccurrenceArrivalTime: Locator;

  private readonly occurrencesCount: Locator;

  private readonly manageTimetableItemPage: Locator;

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
    this.testedPacedTrain = page.locator('.paced-train:not(.closed)');
    this.testedPacedTrainToggleIcon = this.testedPacedTrain.locator('.toggle-icon');
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
    this.manageTimetableItemPage = page.getByTestId('manage-timetable-item');
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

  // Only the zone with the role button opens the occurrence list
  private async getPacedTrainToClickableZone(index: number) {
    return this.pacedTrainItem.nth(index).getByTestId('paced-train-name');
  }

  async verifyPacedTrainItemDetails(
    pacedTrainData: PacedTrainDetails,
    index: number,
    {
      copyTranslation,
      occurrenceData,
      pacedTrainCardAlreadyOpen,
    }: {
      copyTranslation?: string;
      occurrenceData?: OccurrenceDetails[];
      pacedTrainCardAlreadyOpen?: boolean;
    } = {}
  ) {
    const { name, labels, interval, expectedOccurrencesCount } = pacedTrainData;

    const pacedTrainItemClickableZone = await this.getPacedTrainToClickableZone(index);

    // In paced_trains.json, invalid paced trains are marked with an `Invalid` label
    // An invalid paced train won't have any details
    if (labels?.includes('Invalid')) return;

    // Open the occurrences list to be able to have a unique
    // paced train locator for the tested one
    await expect(pacedTrainItemClickableZone).toBeVisible();
    if (!pacedTrainCardAlreadyOpen) await pacedTrainItemClickableZone.click();

    await expect(this.testedPacedTrainShowOccurrencesButton).not.toBeVisible();
    await expect(this.testedPacedTrainOccurrences.first()).toBeVisible();

    if (expectedOccurrencesCount !== undefined) {
      await expect(this.testedPacedTrainOccurrences).toHaveCount(expectedOccurrencesCount);
      await this.verifyOccurrencesCount(expectedOccurrencesCount, index);
    }

    let expectedName = name;
    if (copyTranslation) {
      // duplicated train name should have format : "name (copy)"
      expectedName = `${name} (${copyTranslation})`;
    }
    await expect(this.testedPacedTrainName).toBeVisible();
    await expect(this.testedPacedTrainName).toHaveText(expectedName);

    await expect(this.testedPacedTrainInterval).toBeVisible();
    await expect(this.testedPacedTrainInterval).toHaveText(
      `${String.fromCodePoint(0x2014)} ${interval}min`
    ); // UI format: "- Xmin"

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

    // Close back the occurrences list
    await this.testedPacedTrainToggleIcon.click();
  }

  async verifyOccurrencesCount(expectedOccurrencesCount: number, index: number) {
    const pacedTrainOccurrencesCount = this.occurrencesCount.nth(index);
    await expect(pacedTrainOccurrencesCount).toBeVisible();
    const occurrencesCount = await pacedTrainOccurrencesCount.textContent();
    expect(+occurrencesCount!).toEqual(expectedOccurrencesCount);
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
    itemIndex,
    itemType,
    withExceptions = false,
    checkVisibility = false,
  }: {
    itemIndex: number;
    itemType: 'paced-train' | 'occurrence';
    withExceptions?: boolean;
    checkVisibility?: boolean;
  }): Promise<Record<string, Locator>> {
    const isPacedTrain = itemType === 'paced-train';

    const item = isPacedTrain
      ? this.pacedTrainItem.nth(itemIndex)
      : this.testedPacedTrainOccurrences.nth(itemIndex);
    await expect(item).toBeVisible();
    await item.hover({ force: true });

    const actionButtons: Record<string, Locator> = {
      projectItem: item.getByTestId('project-item'),
      duplicateItem: item.getByTestId('duplicate-item'),
      editItem: item.getByTestId('edit-item'),
      deleteItem: item.getByTestId('delete-item'),
    };

    if (isPacedTrain && withExceptions) {
      actionButtons.resetExceptions = item.getByTestId('reset-exceptions');
    }

    if (checkVisibility) {
      for (const locator of Object.values(actionButtons)) {
        await expect(locator).toBeVisible();
      }
    }

    return actionButtons;
  }

  private async verifyItemsVisibility(
    itemIndex: number,
    itemType: 'paced-train' | 'occurrence'
  ): Promise<void> {
    const actionButtonsLocators = await this.getActionButtonsLocators({ itemIndex, itemType });

    // Actions buttons should be visible when hovering a paced train but not for an occurrence
    await Promise.all(
      Object.values(actionButtonsLocators).map((locator) =>
        itemType === 'paced-train'
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
    const pacedTrainItemClickableZone = await this.getPacedTrainToClickableZone(pacedTrainIndex);

    // Open the occurrences list to be able to have a unique
    // paced train locator for the tested one
    await expect(pacedTrainItemClickableZone).toBeVisible();
    await pacedTrainItemClickableZone.click();

    const occurrenceItem = this.testedPacedTrainOccurrences.nth(occurrenceIndex);
    await occurrenceItem.click();

    await pacedTrainItemClickableZone.click();
  }

  async duplicatePacedTrain() {
    const pacedTrainItem = await this.getPacedTrainToClickableZone(0);
    await pacedTrainItem.click();
    const actionButtons = await this.getActionButtonsLocators({
      itemIndex: 0,
      itemType: 'paced-train',
    });
    await actionButtons.duplicateItem.click();

    await pacedTrainItem.click();
  }

  async openPacedTrainEditor(index = 0) {
    const pacedTrainItem = await this.getPacedTrainToClickableZone(index);
    await expect(pacedTrainItem).toBeVisible();
    await pacedTrainItem.click();
    const actionButtons = await this.getActionButtonsLocators({
      itemIndex: index,
      itemType: 'paced-train',
    });
    await expect(actionButtons.editItem).toBeVisible();
    await actionButtons.editItem.click();
    await expect(this.manageTimetableItemPage).toBeVisible();
  }

  async projectPacedTrain(index = 0) {
    const pacedTrainItem = await this.getPacedTrainToClickableZone(index);
    await expect(pacedTrainItem).toBeVisible();
    await pacedTrainItem.click();
    const actionButtons = await this.getActionButtonsLocators({
      itemIndex: index,
      itemType: 'paced-train',
    });
    await expect(actionButtons.projectItem).toBeVisible();
    await actionButtons.projectItem.click();
  }

  async deletePacedTrain(
    index: number,
    translations: TimetableFilterTranslations,
    pacedTrainData?: PacedTrainDetails
  ) {
    const timetableItemToDelete = await this.getPacedTrainToClickableZone(index);
    await expect(timetableItemToDelete).toBeVisible();
    await timetableItemToDelete.click();

    const pacedTrainActionButtons = await this.getActionButtonsLocators({
      itemIndex: index,
      itemType: 'paced-train',
    });
    await pacedTrainActionButtons.deleteItem.click();

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

  async clickOnPacedTrain(index: number) {
    const pacedTrainItemClickableZone = await this.getPacedTrainToClickableZone(index);
    await expect(pacedTrainItemClickableZone).toBeVisible();
    await pacedTrainItemClickableZone.click();
  }

  async clickOccurrenceMenuButton(buttonToClick: OccurrenceMenuButton) {
    const portalOccurrenceMenu = this.portalOccurrenceMenu[buttonToClick];
    await expect(portalOccurrenceMenu).toBeVisible();
    await portalOccurrenceMenu.click();
  }

  async resetAllPacedTrainExceptions(pacedTrainIndex: number) {
    const timetableItemToReset = await this.getPacedTrainToClickableZone(pacedTrainIndex);
    await expect(timetableItemToReset).toBeVisible();
    await timetableItemToReset.click();

    const { resetExceptions } = await this.getActionButtonsLocators({
      itemIndex: pacedTrainIndex,
      itemType: 'paced-train',
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
