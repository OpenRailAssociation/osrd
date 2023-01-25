/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '@playwright/test';

export class PlaywrightHomePage {
  readonly page: Page;

  readonly getStudiesLink: Locator;

  readonly getCartoLink: Locator;

  readonly getEditorLink: Locator;

  readonly getSTDCMLink: Locator;

  readonly getImportLink: Locator;

  readonly getLinks: Locator;

  readonly getBackHomeLogo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.getStudiesLink = page.getByRole('link', { name: /Études d'exploitation/ });
    this.getCartoLink = page.getByRole('link', { name: /Cartographie/ });
    this.getEditorLink = page.getByRole('link', { name: /Éditeur d'infrastructure/ });
    this.getSTDCMLink = page.getByRole('link', { name: /Sillons de dernière minute/ });
    this.getImportLink = page.getByRole('link', { name: /Importation horaires/ });
    this.getLinks = page.locator('h5');
    this.getBackHomeLogo = page.locator('.mastheader-logo');
  }

  async goToHomePage() {
    await this.page.goto('/');
  }

  async backToHomePage() {
    await this.getBackHomeLogo.click();
  }

  async getDisplayLinks() {
    expect(this.getLinks).toContainText([
      "Études d'exploitation",
      'Cartographie',
      "Éditeur d'infrastructure",
      'Sillons de dernière minute',
      'Importation horaires',
    ]);
  }

  async goToStudiesPage() {
    await this.getStudiesLink.click();
  }

  async goToCartoPage() {
    await this.getCartoLink.click();
  }

  async goToEditorPage() {
    await this.getEditorLink.click();
  }

  async goToSTDCMPage() {
    await this.getSTDCMLink.click();
  }

  async goToImportPage() {
    await this.getImportLink.click();
  }
}
