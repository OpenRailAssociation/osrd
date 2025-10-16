import { expect, type Locator, type Page } from '@playwright/test';

import OpSimulationResultPage from './simulation-results-page';

enum TrainTabs {
  Overview = 0,
  Stations = 1,
  Tags = 2,
  OneWay = 3,
}

class NGEPage extends OpSimulationResultPage {
  private readonly ngeFrame;
  private readonly nodeCards: Locator;
  private readonly nodeTexts: Locator;
  private readonly trainLabelRows: Locator;
  private readonly trainDetailTabs: Locator;
  private readonly activeTabPanel: Locator;
  private readonly trainDetailsGroup: Locator;
  private readonly oneWayCardMuted: Locator;
  private readonly oneWayCardSelected: Locator;
  private readonly nodeSummaryTitle: Locator;
  private readonly deleteNodeButton: Locator;
  private readonly confirmDeleteButton: Locator;
  private readonly closeDialogButton: Locator;

  private readonly stationLeftArrow: Locator;
  private readonly stationRightArrow: Locator;
  constructor(page: Page) {
    super(page);

    this.ngeFrame = page.frameLocator('iframe[title="NGE"]');
    this.nodeCards = this.ngeFrame.locator('.root_container_nodes');
    this.nodeTexts = this.nodeCards.locator('.node_text');
    this.trainLabelRows = this.ngeFrame.locator('.edge.Labels');
    this.trainDetailTabs = this.ngeFrame.getByRole('tab');
    this.activeTabPanel = this.ngeFrame.getByRole('tabpanel');
    this.trainDetailsGroup = this.ngeFrame.locator('.TrainrunTabGrupe');
    this.oneWayCardMuted = this.ngeFrame.locator('.OneWayCard.muted');
    this.oneWayCardSelected = this.ngeFrame.locator('.OneWayCard.selected');
    this.nodeSummaryTitle = this.dialog.locator('.SummaryTitle');
    this.deleteNodeButton = this.dialog.locator(
      'button[sbb-secondary-button][svgicon="trash-small"]'
    );
    this.confirmDeleteButton = this.dialog.locator(
      'button.sbb-button[tabindex="0"][type="button"]'
    );
    this.closeDialogButton = this.ngeFrame.getByRole('img', { name: 'Close Dialog' });
    this.stationLeftArrow = this.ngeFrame.locator('[data-sbb-icon-name="arrow-left-medium"]');
    this.stationRightArrow = this.ngeFrame.locator('[data-sbb-icon-name="arrow-right-medium"]');
  }

  private getNodeNameByIndex(index: number): Locator {
    return this.nodeTexts.nth(index);
  }

  private getTrainLabel(lineIndex: number, labelIndex: number): Locator {
    return this.trainLabelRows.nth(lineIndex).locator('.edge_text').nth(labelIndex);
  }

  async toggleTopologyEditor() {
    await this.topologyEditorToggle.click();
  }

  async clickGraphAt(position: { x: number; y: number }) {
    await this.graphContainer.click({ position });
  }

  async fillNodeDetails(trigram: string, name: string) {
    await this.textInputs.first().fill(trigram);
    await this.textInputs.nth(1).fill(name);
  }

  async closeAside() {
    await this.closeAsideButton.click();
  }

  async expectNodes([origin, op, destination]: [string, string, string]) {
    await expect(this.nodeCards).toHaveCount(3);
    await expect(this.getNodeNameByIndex(0)).toHaveText(origin);
    await expect(this.getNodeNameByIndex(1)).toHaveText(op);
    await expect(this.getNodeNameByIndex(2)).toHaveText(destination);
  }

  async expectTrainLineLabels(lineIndex: number, expected: string[]) {
    for (let labelIndex = 0; labelIndex < expected.length; labelIndex++) {
      await expect(this.getTrainLabel(lineIndex, labelIndex)).toHaveText(expected[labelIndex]);
    }
  }

  async openTrainDetailsFromLine(rowIndex: number) {
    await this.getTrainLabel(rowIndex, 3).click();
    await expect(this.trainDetailsGroup).toBeVisible();
    await expect(this.trainDetailTabs).toHaveCount(4);
  }

  async expectDialogHeaderTrainName(name: string) {
    await expect(this.trainDetailTabs.nth(TrainTabs.Overview)).toHaveText(name);
  }

  async expectStationsTabShows([leftStation, rightStation]: [string, string]) {
    const stationsTab = this.trainDetailTabs.nth(TrainTabs.Stations);
    const stationSpans = stationsTab.locator('span');

    await expect(stationSpans).toHaveCount(2);

    const hasLeftArrow = await this.stationLeftArrow.isVisible().catch(() => false);
    const hasRightArrow = await this.stationRightArrow.isVisible().catch(() => false);

    if (hasLeftArrow) {
      await expect(stationSpans.nth(0)).toHaveText(leftStation);
      await expect(this.stationLeftArrow).toBeVisible();
      await expect(stationSpans.nth(1)).toHaveText(rightStation);
    } else if (hasRightArrow) {
      await expect(stationSpans.nth(0)).toHaveText(rightStation);
      await expect(this.stationRightArrow).toBeVisible();
      await expect(stationSpans.nth(1)).toHaveText(leftStation);
    }
  }

  async openTagsTabAndExpect(tags: string[]) {
    await this.trainDetailTabs.nth(TrainTabs.Tags).click();
    const listbox = this.activeTabPanel.getByRole('listbox');
    const options = listbox.getByRole('option');
    await expect(listbox).toBeVisible();
    await expect(options).toHaveText(tags);
  }

  async openOneWayTabAndExpect(regex: RegExp) {
    await this.trainDetailTabs.nth(TrainTabs.OneWay).click();
    await expect(this.oneWayCardMuted).toContainText(regex);
    await expect(this.oneWayCardSelected).toContainText(regex);
  }

  async closeDetailsDialogIfVisible() {
    const visible = await this.trainDetailsGroup.isVisible().catch(() => false);
    if (visible) await this.closeDialogButton.click();
  }
}

export default NGEPage;
