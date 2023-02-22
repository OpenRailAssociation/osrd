import { expect, Locator, Page } from '@playwright/test';
/* eslint-disable import/prefer-default-export */
import infraManagement from '../public/locales/fr/infraManagement.json';
import rollingstockTranslation from '../public/locales/fr/rollingstock.json';

export class PlaywrightSTDCMPage {
  readonly page: Page;

  readonly getBody: Locator;

  readonly translation: typeof infraManagement;

  readonly rollingstockTranslation: typeof rollingstockTranslation;

  // Scenario Explorator
  readonly getScenarioExplorator: Locator;

  readonly getScenarioExploratorModal: Locator;

  readonly getItemsScenarioExplorator: Locator;

  // Rollingstock
  readonly getRollingStockSelector: Locator;

  readonly getRollingstockModal: Locator;

  readonly getRollingStockSearch: Locator;

  readonly getRollingStockSearchFilter: Locator;

  readonly getRollingStockSearchList: Locator;

  readonly getRollingStockListItem: Locator;

  readonly getRollingstockSpanNames: Locator;

  constructor(page: Page) {
    this.page = page;
    this.getBody = page.locator('body');
    this.translation = infraManagement;

    // Scenario Explorator
    this.getScenarioExplorator = page.getByTestId('scenario-explorator');
    this.getScenarioExploratorModal = page.locator('.scenario-explorator-modal');
    this.getItemsScenarioExplorator = page.locator(
      '.scenario-explorator-modal-part-itemslist-minicard'
    );

    // Rollingstock
    this.getRollingstockModal = page.locator('.modal-dialog');
    this.getRollingStockSelector = page.getByTestId('rollingstock-selector');
    this.getRollingStockSearch = page.locator('.rollingstock-search');
    this.getRollingStockSearchFilter = page.locator('.rollingstock-search-filters');
    this.getRollingStockSearchList = page.locator('.rollingstock-search-list');
    this.getRollingStockListItem = page.locator('.rollingstock-container');
    this.getRollingstockSpanNames = this.getRollingStockListItem.locator('.rollingstock-infos-end');
    this.rollingstockTranslation = rollingstockTranslation;
  }

  getTranslations(key: keyof typeof infraManagement) {
    return this.translation[key];
  }

  // Scenario Explorator
  async openScenarioExplorator() {
    await this.getScenarioExplorator.click();
  }

  async getScenarioExploratorModalClose() {
    await expect(this.getScenarioExploratorModal).not.toBeVisible();
  }

  async getScenarioExploratorModalOpen() {
    await expect(this.getScenarioExploratorModal).toBeVisible();
  }

  getItemScenarioExploratorByName(itemName: string): Locator {
    return this.getItemsScenarioExplorator.getByText(itemName);
  }

  async clickItemScenarioExploratorByName(itemName: string) {
    await this.getItemScenarioExploratorByName(itemName).click();
  }

  // Rollingstock
  async getRollingstockModalOpen() {
    await expect(this.getRollingstockModal).toBeVisible();
  }

  async getRollingstockModalClose() {
    await expect(this.getRollingstockModal).not.toBeVisible();
  }

  async openRollingstockModal() {
    await this.getRollingStockSelector.click();
  }

  async closeRollingstockModal() {
    await this.getRollingstockModal.locator('.close').click();
  }

  getRollingstockByTestId(dataTestId: string) {
    return this.getRollingStockSearchList.getByTestId(dataTestId);
  }

  getRollingstockTranslations(key: keyof typeof rollingstockTranslation) {
    return this.rollingstockTranslation[key];
  }
}
