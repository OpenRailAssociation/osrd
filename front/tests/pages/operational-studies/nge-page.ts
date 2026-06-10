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
  readonly nodeCards: Locator;
  private readonly nodeTexts: Locator;
  readonly trainLines: Locator;
  private readonly trainLabelRows: Locator;
  private readonly trainDetailTabs: Locator;
  private readonly activeTabPanel: Locator;
  readonly trainDetailsGroup: Locator;
  private readonly oneWayCardMuted: Locator;
  private readonly oneWayCardSelected: Locator;
  private readonly nodeSummaryTitle: Locator;
  private readonly deleteNodeButton: Locator;
  private readonly confirmDeleteButton: Locator;
  private readonly closeDialogButton: Locator;
  private readonly topologyEditorToggle: Locator;
  private readonly graphContainer: Locator;
  private readonly textInputs: Locator;
  private readonly closeAsideButton: Locator;
  private readonly trainTitleField: Locator;
  private readonly frequency30Btn: Locator;
  private readonly stationLeftArrow: Locator;
  private readonly stationRightArrow: Locator;
  constructor(page: Page) {
    super(page);

    this.ngeFrame = page.frameLocator('iframe[title="NGE"]');
    this.nodeCards = this.ngeFrame.getByTestId('root_container_nodes');
    this.nodeTexts = this.nodeCards.getByTestId('node_text');
    this.trainLines = this.ngeFrame.getByTestId('edge-lines');
    this.trainLabelRows = this.ngeFrame.getByTestId('edge-labels');
    this.trainDetailTabs = this.ngeFrame.getByRole('tab');
    this.activeTabPanel = this.ngeFrame.getByRole('tabpanel');
    this.trainDetailsGroup = this.ngeFrame.getByTestId('train-run-tab-group');
    this.oneWayCardMuted = this.ngeFrame.getByTestId('one-way-top-card');
    this.oneWayCardSelected = this.ngeFrame.getByTestId('one-way-bottom-card');
    this.nodeSummaryTitle = this.ngeFrame.getByTestId('summary-title');
    this.deleteNodeButton = this.ngeFrame.getByTestId('delete-button');
    this.confirmDeleteButton = this.ngeFrame.getByTestId('confirm-button');
    this.closeDialogButton = this.ngeFrame.locator('.dialog-close-button-icon');
    this.topologyEditorToggle = this.ngeFrame.getByTestId('topology-editor-button');
    this.graphContainer = this.ngeFrame.getByTestId('graph-container');
    this.textInputs = this.ngeFrame.locator('.sbb-input-element');
    this.closeAsideButton = this.ngeFrame.getByTestId('close-aside-button');
    this.trainTitleField = this.ngeFrame.getByTestId('train-run-title-input');
    this.frequency30Btn = this.ngeFrame.getByTestId('frequency-30');
    this.stationLeftArrow = this.ngeFrame.getByRole('img', { name: 'arrow-left-medium' });
    this.stationRightArrow = this.ngeFrame.getByRole('img', { name: 'arrow-right-medium' });
  }

  private getNodeNameByIndex(index: number): Locator {
    return this.nodeTexts.nth(index);
  }

  private getTrainLabel(lineIndex: number, labelIndex: number): Locator {
    return this.trainLabelRows
      .nth(lineIndex)
      .locator('[data-testid="edge_text"]:not(.hidden)')
      .nth(labelIndex);
  }

  async toggleTopologyEditor() {
    await this.topologyEditorToggle.click();
  }

  async clickGraphAt(position: { x: number; y: number }) {
    await this.graphContainer.click({ position });
  }

  async fillNodeDetails(mainCode: string, name: string) {
    await this.textInputs.first().fill(mainCode);
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
    const stationLabels = stationsTab.locator('.sbb-tab-label-content');

    await expect(stationLabels).toContainText(leftStation);
    await expect(stationLabels).toContainText(rightStation);
    const hasLeftArrow = await this.stationLeftArrow.isVisible().catch(() => false);
    const hasRightArrow = await this.stationRightArrow.isVisible().catch(() => false);

    if (hasLeftArrow) {
      await expect(stationLabels).toHaveText(new RegExp(`${leftStation}.*${rightStation}`));
    } else if (hasRightArrow) {
      {
        await expect(stationLabels).toHaveText(new RegExp(`${rightStation}.*${leftStation}`));
      }
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

  async verifyNodeAndLinesCount(expected: { nodes: number; lines: number }) {
    await expect(this.nodeCards).toHaveCount(expected.nodes);
    await expect(this.trainLines).toHaveCount(expected.lines);
  }

  async deleteNodeByIndexViaDialog(index: number, expected: { nodes: number; lines: number }) {
    await this.nodeTexts.nth(index).dblclick();
    await expect(this.nodeSummaryTitle).toBeVisible();

    await expect(this.deleteNodeButton).toBeEnabled();
    await this.deleteNodeButton.click();

    await expect(this.confirmDeleteButton).toBeEnabled();
    await this.confirmDeleteButton.click();

    await this.verifyNodeAndLinesCount(expected);
  }

  async deleteFocusedNodeWithKeyboard(expected: { nodes: number; lines: number }) {
    await this.nodeTexts.first().hover();
    await this.page.keyboard.press('Delete');

    await this.verifyNodeAndLinesCount(expected);
  }

  async connectNodesByIndex(fromIndex: number, toIndex: number) {
    const from = this.nodeCards.nth(fromIndex);
    const to = this.nodeCards.nth(toIndex);

    await Promise.all([expect(from).toBeVisible(), expect(to).toBeVisible()]);

    const fromBox = await from.boundingBox();
    const toBox = await to.boundingBox();
    if (!fromBox || !toBox) throw new Error('Element not visible on screen');

    await this.page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, {
      steps: 15,
    });
    await this.page.mouse.up();
  }

  async createNode(position: { x: number; y: number }, mainCode: string, name: string) {
    await this.toggleTopologyEditor();
    await this.clickGraphAt(position);
    await this.fillNodeDetails(mainCode, name);
    await this.closeAside();
  }

  async setTrainBasics({ name, isFrequency30 }: { name: string; isFrequency30?: boolean }) {
    await this.trainTitleField.fill(name);
    if (isFrequency30) await this.frequency30Btn.click();
  }
}

export default NGEPage;
