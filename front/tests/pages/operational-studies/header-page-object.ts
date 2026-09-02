import { type Locator, type Page, expect } from '@playwright/test';

import { frTranslations } from '../../assets/constants/train-header-const';
import { escapeRegExp } from '../../utils/data-normalizer';
import CommonPage from '../common-page';

function extraOccurrencesLabel(count: number): string {
  const { form } = frTranslations.trainHeader;
  if (count === 0) return form.extraOccurrences_zero;
  if (count === 1) return form.extraOccurrences_one.replace('{{count}}', '1');
  return form.extraOccurrences_other.replace('{{count}}', String(count));
}

class HeaderPageObject extends CommonPage {
  private readonly collapsedHeader: Locator;
  private readonly expandedHeader: Locator;
  private readonly kindBadge: Locator;
  private readonly expandToggle: Locator;
  private readonly collapseToggle: Locator;
  private readonly cadenceSummary: Locator;
  private readonly departureDateSummary: Locator;
  private readonly categorySummary: Locator;
  private readonly rollingStockSummary: Locator;
  private readonly compositionCodeSummary: Locator;
  private readonly recoveryMarginSummary: Locator;
  private readonly nameInput: Locator;
  private readonly departureDateInput: Locator;
  private readonly initialVelocityInput: Locator;
  private readonly categorySelect: Locator;
  private readonly rollingStockInput: Locator;
  private readonly rollingStockSuggestions: Locator;
  private readonly compositionCodeSelect: Locator;
  private readonly recoveryMarginSelect: Locator;
  private readonly comfortSelect: Locator;
  private readonly electricalProfilesCheckbox: Locator;
  private readonly tagsInput: Locator;
  private readonly tagItems: Locator;
  private readonly scheduleKindToggle: Locator;
  private readonly itineraryButton: Locator;
  readonly serviceCadenceInput: Locator;
  readonly serviceWindowHourInput: Locator;
  readonly serviceWindowMinuteInput: Locator;
  private readonly extraOccurrencesToggle: Locator;
  private readonly extraOccurrenceRows: Locator;
  private readonly extraOccurrenceDateInput: Locator;
  private readonly extraOccurrenceTimeInput: Locator;
  private readonly extraOccurrenceAddButton: Locator;
  private readonly serviceChangeHeader: Locator;
  private readonly serviceChangeCancelButton: Locator;
  private readonly serviceChangeConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.collapsedHeader = page.getByTestId('train-header-collapsed');
    this.expandedHeader = page.getByTestId('train-header-expanded');
    this.kindBadge = page.getByTestId('train-header-kind');
    this.expandToggle = this.collapsedHeader.getByTestId('train-header-expand-toggle');
    this.collapseToggle = this.expandedHeader.getByTestId('train-header-collapse-toggle');

    this.cadenceSummary = this.collapsedHeader.getByTestId('train-service-interval');
    this.departureDateSummary = this.collapsedHeader.getByTestId('train-departure-date');
    this.categorySummary = this.collapsedHeader.getByTestId('train-category');
    this.rollingStockSummary = this.collapsedHeader.getByTestId('train-rolling-stock');
    this.compositionCodeSummary = this.collapsedHeader.getByTestId('train-composition-code');
    this.recoveryMarginSummary = this.collapsedHeader.getByTestId('train-recovery-margin');

    this.nameInput = this.expandedHeader.getByTestId('train-header-name-input');
    this.departureDateInput = this.expandedHeader.getByTestId('train-header-departure-date-input');
    this.initialVelocityInput = this.expandedHeader.getByTestId(
      'train-header-initial-velocity-input'
    );
    this.categorySelect = this.expandedHeader.getByTestId('train-header-category-select');
    this.rollingStockInput = this.expandedHeader.getByTestId('train-header-rolling-stock-input');
    this.rollingStockSuggestions = this.expandedHeader.getByTestId(
      'train-header-rolling-stock-item'
    );
    this.compositionCodeSelect = this.expandedHeader.getByTestId(
      'train-header-composition-code-select'
    );
    this.recoveryMarginSelect = this.expandedHeader.getByTestId(
      'train-header-recovery-margin-select'
    );
    this.comfortSelect = this.expandedHeader.getByTestId('train-header-comfort-select');
    this.electricalProfilesCheckbox = this.expandedHeader.getByTestId(
      'train-header-electric-profile-checkbox'
    );
    this.tagsInput = this.expandedHeader.getByTestId('train-header-tags-input');
    this.tagItems = this.expandedHeader.getByTestId('train-header-tags-token');
    this.scheduleKindToggle = this.expandedHeader.getByTestId('train-header-schedule-kind-toggle');
    this.itineraryButton = this.expandedHeader.getByTestId('train-header-itinerary-button');

    this.serviceCadenceInput = this.expandedHeader.getByTestId('train-header-service-cadence-m');
    this.serviceWindowHourInput = this.expandedHeader.getByTestId('train-header-service-window-h');
    this.serviceWindowMinuteInput = this.expandedHeader.getByTestId(
      'train-header-service-window-m'
    );
    this.extraOccurrencesToggle = this.expandedHeader.getByTestId(
      'train-header-extra-occurrences-toggle'
    );
    this.extraOccurrenceRows = this.expandedHeader.getByTestId('train-header-extra-occurrence-row');
    this.extraOccurrenceDateInput = this.expandedHeader.getByTestId(
      'train-header-extra-occurrence-date-input'
    );
    this.extraOccurrenceTimeInput = this.expandedHeader.getByTestId(
      'train-header-extra-occurrence-time-input'
    );
    this.extraOccurrenceAddButton = this.expandedHeader.getByTestId(
      'train-header-extra-occurrence-add-button'
    );

    this.serviceChangeHeader = this.expandedHeader.getByTestId(
      'train-header-service-change-header'
    );
    this.serviceChangeCancelButton = this.expandedHeader.getByTestId(
      'train-header-service-change-cancel-button'
    );
    this.serviceChangeConfirmButton = this.expandedHeader.getByTestId(
      'train-header-service-change-confirm-button'
    );
  }

  async expandHeader() {
    await expect(this.collapsedHeader).toBeVisible();
    await this.expandToggle.click();
    await expect(this.expandedHeader).toBeVisible();
  }

  async collapseHeader() {
    await expect(this.expandedHeader).toBeVisible();
    await this.collapseToggle.click();
    await expect(this.collapsedHeader).toBeVisible();
  }

  async verifyKindBadge(expectedText: string) {
    await expect(this.kindBadge).toBeVisible();
    await expect(this.kindBadge).toHaveText(expectedText);
  }

  async verifyKindBadgeAbsent() {
    await expect(this.kindBadge).not.toBeVisible();
  }

  async verifyCollapsedSummary(summary: {
    departureDate?: string;
    category?: string;
    rollingStock?: string;
    compositionCode?: string;
    recoveryMargin?: string;
    cadence?: string;
  }) {
    await expect(this.collapsedHeader).toBeVisible();

    if (summary.departureDate !== undefined) {
      await expect(this.departureDateSummary).toHaveText(summary.departureDate);
    }
    if (summary.category !== undefined) {
      await expect(this.categorySummary).toHaveText(summary.category);
    }
    if (summary.rollingStock !== undefined) {
      await expect(this.rollingStockSummary).toHaveText(summary.rollingStock);
    }
    if (summary.compositionCode !== undefined) {
      await expect(this.compositionCodeSummary).toHaveText(summary.compositionCode);
    }
    if (summary.recoveryMargin !== undefined) {
      await expect(this.recoveryMarginSummary).toHaveText(summary.recoveryMargin);
    }
    if (summary.cadence !== undefined) {
      await expect(this.cadenceSummary).toContainText(summary.cadence);
    }
  }

  async verifyCadenceSummaryAbsent() {
    await expect(this.cadenceSummary).not.toBeVisible();
  }

  async verifyExpandedFormFields(train: {
    name: string;
    departureDate: string;
    initialVelocity: string;
    category: string;
    rollingStock: string;
    compositionCode: string;
    recoveryMargin: string;
    comfort: string;
    useElectricalProfiles: boolean;
    labels: string[];
  }) {
    await expect(this.nameInput).toHaveValue(train.name);
    await expect(this.departureDateInput).toHaveValue(train.departureDate);
    await expect(this.initialVelocityInput).toHaveValue(train.initialVelocity);
    await expect(this.categorySelect).toHaveValue(train.category);
    await expect(this.rollingStockInput).toHaveValue(new RegExp(escapeRegExp(train.rollingStock)));
    await expect(this.compositionCodeSelect).toHaveValue(train.compositionCode);
    await expect(this.recoveryMarginSelect).toHaveValue(train.recoveryMargin);
    await expect(this.comfortSelect).toHaveValue(train.comfort);
    if (train.useElectricalProfiles) {
      await expect(this.electricalProfilesCheckbox).toBeChecked();
    } else {
      await expect(this.electricalProfilesCheckbox).not.toBeChecked();
    }
    expect(await this.getTagLabels()).toEqual(train.labels);
  }

  async setName(name: string) {
    await this.nameInput.fill(name);
    await this.nameInput.blur();
  }

  async setDepartureDate(date: string) {
    await this.departureDateInput.fill(date);
    await this.departureDateInput.blur();
  }

  async setInitialVelocity(value: string) {
    await this.initialVelocityInput.fill(value);
    await this.initialVelocityInput.blur();
  }

  async selectCategory(categoryOptionValue: string) {
    await this.categorySelect.selectOption({ value: categoryOptionValue });
  }

  async setRollingStock(name: string) {
    await this.rollingStockInput.fill(name);
    await this.rollingStockSuggestions.filter({ hasText: name }).first().click();
  }

  async selectCompositionCode(speedLimitTag: string) {
    await this.compositionCodeSelect.selectOption({ value: speedLimitTag });
  }

  async selectRecoveryMargin(distribution: 'STANDARD' | 'MARECO') {
    await this.recoveryMarginSelect.selectOption({ value: distribution });
  }

  async selectComfort(comfort: 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING') {
    await this.comfortSelect.selectOption({ value: comfort });
  }

  async toggleElectricalProfiles(checked: boolean) {
    await this.electricalProfilesCheckbox.setChecked(checked, { force: true });
  }

  async toggleScheduleKind(checked: boolean) {
    await this.scheduleKindToggle.setChecked(checked, { force: true });
  }

  async openItinerary() {
    await this.itineraryButton.click();
  }

  async addTag(tag: string) {
    await this.tagsInput.fill(tag);
    await this.tagsInput.press('Enter');
  }

  private async getTagLabels(): Promise<string[]> {
    return this.tagItems.allTextContents();
  }

  async setServiceCadenceMinutes(minutes: string) {
    await this.serviceCadenceInput.fill(minutes);
    await this.serviceCadenceInput.press('Enter');
  }

  async setServiceWindow(hours: string, minutes: string) {
    await this.serviceWindowHourInput.fill(hours);
    await this.serviceWindowMinuteInput.fill(minutes);
    await this.serviceWindowMinuteInput.press('Enter');
  }

  async verifyServiceCadenceAndWindow(
    intervalMinutes: string,
    windowHours: string,
    windowMinutes: string
  ) {
    await expect(this.serviceCadenceInput).toHaveValue(intervalMinutes);
    await expect(this.serviceWindowHourInput).toHaveValue(windowHours);
    await expect(this.serviceWindowMinuteInput).toHaveValue(windowMinutes);
  }

  async verifyServiceChangeDialogVisible() {
    await expect(this.serviceChangeHeader).toBeVisible();
    await expect(this.serviceChangeConfirmButton).toBeVisible();
    await expect(this.serviceChangeCancelButton).toBeVisible();
  }

  async confirmServiceChange() {
    await this.serviceChangeConfirmButton.click();
  }

  async cancelServiceChange() {
    await this.serviceChangeCancelButton.click();
  }

  async toggleExtraOccurrences() {
    await this.extraOccurrencesToggle.click();
  }

  async createExtraOccurrence(date: string, time: string) {
    await this.extraOccurrenceDateInput.fill(date);
    await this.extraOccurrenceTimeInput.fill(time);
    await this.extraOccurrenceAddButton.click();
  }

  async verifyExtraOccurrencesToggleLabel(expectedCount: number) {
    await expect(this.extraOccurrencesToggle).toHaveText(extraOccurrencesLabel(expectedCount));
  }

  async expectExtraOccurrenceRowCount(count: number) {
    if (count === 0) {
      await expect(this.extraOccurrenceRows).toHaveCount(0);
      return;
    }
    await expect(this.extraOccurrenceRows.first()).toBeVisible();
    await expect(this.extraOccurrenceRows).toHaveCount(count);
  }
}

export default HeaderPageObject;
