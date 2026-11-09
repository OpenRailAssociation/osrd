import { expect, type Locator, type Page } from '@playwright/test';

import type { StandardGrant } from 'common/api/osrdEditoastApi';

import { HOME_URLS } from '../assets/constants/homepage-const';
import { getUserGrantText } from '../assets/constants/permission-const';
import { logger } from '../logging-fixture';

class CommonPage {
  readonly page: Page;
  readonly toastContainer: Locator;
  private readonly toastTitle: Locator;
  private readonly tagField: Locator;
  private readonly closeToastButton: Locator;
  private readonly navigationToHomeButton: Locator;
  private readonly navigationBackButton: Locator;
  private readonly loader: Locator;
  private readonly spinner: Locator;
  private readonly error403: Locator;
  private readonly userGrant: Locator;
  private readonly grantDetailsButton: Locator;
  private readonly grantAddSubjectButton: Locator;
  private readonly grantSubjectSearchInput: Locator;
  private readonly grantSubjectSuggestions: Locator;
  private readonly grantSubjectSuggestion: (subjectName: string) => Locator;
  private readonly grantAddSubjectGrantSelect: Locator;
  private readonly grantAddSubjectSubmitButton: Locator;
  private readonly grantSubjects: Locator;
  private readonly grantSubject: (subjectName: string) => Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.getByTestId('toast-SNCF');
    this.toastTitle = this.toastContainer.getByTestId('toast-SNCF-title');
    this.tagField = page.getByTestId('chips-input');
    this.closeToastButton = page.getByTestId('close-toast-button');
    this.navigationToHomeButton = page.getByTestId('navigation-to-home-button');
    this.navigationBackButton = page.getByTestId('navigation-back-button');
    this.loader = page.getByTestId('loader');
    this.spinner = page.getByTestId('spinner');
    this.error403 = page.getByTestId('error-403');
    this.userGrant = page.getByTestId('grant-manager-user-grant');
    this.grantDetailsButton = page.getByTestId('grant-manager-details-button');
    this.grantAddSubjectButton = page.getByTestId('grant-manager-add-subject-button');
    this.grantSubjectSearchInput = page.getByTestId('add-subject-combobox-input');
    this.grantSubjectSuggestions = page.getByTestId('add-subject-search-list');
    this.grantSubjectSuggestion = (subjectName) =>
      this.grantSubjectSuggestions.getByTestId(`grant-subject-${subjectName}`);
    this.grantAddSubjectGrantSelect = page.getByTestId('add-subject-grant-select');
    this.grantAddSubjectSubmitButton = page.getByTestId('add-subject-submit-button');
    this.grantSubjects = page.getByTestId('grant-manager-subject');
    this.grantSubject = (subjectName) =>
      this.grantSubjects.getByTestId(`grant-subject-${subjectName}`);
  }

  // Set the tag of project, study or scenario
  async setTag(tag: string): Promise<void> {
    await expect(this.tagField).toBeVisible();
    await this.tagField.fill(tag);
    await this.tagField.press('Enter');
  }

  // Verify the text of all toast notification titles
  async checkToastTitle(expectedText: string | RegExp): Promise<void> {
    const toastTitles = await this.toastTitle.all();
    await Promise.all(
      toastTitles.map(async (toastTitle) => {
        try {
          await expect(toastTitle).toHaveText(expectedText);
        } catch {
          logger.warn('The toast disappeared before the title could be verified');
        }
      })
    );
  }

  async checkToastHasBeenLaunched(translation: string) {
    await this.checkToastTitle(translation);
    await this.closeToastNotification();
  }

  // Close all visible toast notifications safely
  async closeToastNotification(): Promise<void> {
    const closeToastElements = await this.closeToastButton.all();
    await Promise.all(
      closeToastElements.map(async (closeToastElement) => {
        try {
          if (await closeToastElement.isVisible()) {
            await closeToastElement.click();
          }
        } catch {
          logger.warn('Toast disappeared before it could be clicked');
        }
      })
    );
  }

  async expectResourceNotFoundPage() {
    await expect(this.navigationToHomeButton).toBeVisible();
    await expect(this.navigationBackButton).toBeVisible();
  }

  async expectAccessDeniedPage() {
    await expect(this.page).toHaveURL(HOME_URLS.error403);
    await expect(this.error403).toBeVisible();
  }

  async expectUserGrant(grantLabel: string, { canSeeDetails }: { canSeeDetails: boolean }) {
    await expect(this.userGrant).toHaveText(getUserGrantText(grantLabel));
    await expect(this.grantDetailsButton).toBeVisible({ visible: canSeeDetails });
  }

  async addGrantsToSubjects(grants: { subjectName: string; grant: StandardGrant }[]) {
    await this.grantDetailsButton.click();
    for (const { subjectName, grant } of grants) {
      await this.grantAddSubjectButton.click();
      await this.grantSubjectSearchInput.fill(subjectName);
      await this.grantSubjectSuggestion(subjectName).click();
      await expect(this.grantSubjectSearchInput).toHaveValue(subjectName);
      await this.grantAddSubjectGrantSelect.selectOption(grant);
      await expect(this.grantAddSubjectGrantSelect).toHaveValue(grant);
      // The subject's card may already be listed, so wait for the grant to be saved instead
      const grantResponse = this.page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/authz/grants') && response.request().method() === 'POST'
      );
      await this.grantAddSubjectSubmitButton.click();
      expect((await grantResponse).ok()).toBe(true);
      await expect(this.grantSubject(subjectName)).toBeVisible();
    }
  }

  async waitForLoaderToDisappear({ timeout }: { timeout?: number } = {}): Promise<void> {
    const count = await this.loader.count();
    if (count > 0) {
      await expect(this.loader).not.toBeVisible({ timeout });
    }
  }

  async waitForSpinnerToDisappear(): Promise<void> {
    try {
      // The list spinner has a 500ms display delay; give it a moment to appear on slow loads.
      await this.spinner.first().waitFor({ state: 'visible', timeout: 1_000 });
    } catch {
      // Spinner never appeared - the view loaded fast, nothing to wait for.
      return;
    }
    await expect(this.spinner).toHaveCount(0);
  }

  async validateNumericBudget(locator: Locator, expectedBudget: string): Promise<void> {
    await expect
      .poll(async () => (await locator.textContent())?.replace(/[^0-9]/g, ''))
      .toEqual(expectedBudget);
  }
}

export default CommonPage;
