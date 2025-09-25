import { type Locator, type Page, expect } from '@playwright/test';

import OperationalStudiesPage from './operational-studies-page';

class RoundTripPage extends OperationalStudiesPage {
  private readonly manageRoundTripsButton: Locator;

  private readonly roundTripsModalPage: Locator;

  private readonly roundTripsCards: Locator;

  private roundTripsParingColumn: Locator;

  private roundTripPairs: Locator;

  private oneWaysColumnCard: Locator;

  private toDoColumnCard: Locator;

  private readonly oneWaysColumnTitle: Locator;

  private readonly oneWaysItemCount: Locator;

  private readonly roundTripColumnTitle: Locator;

  private readonly roundTripItemCount: Locator;

  private readonly toDoColumnTitle: Locator;

  private readonly toDoItemCount: Locator;

  private readonly saveRoundTripsButton: Locator;

  private readonly cancelRoundTripsButton: Locator;

  private readonly roundTripFilterField: Locator;

  constructor(page: Page) {
    super(page);
    this.manageRoundTripsButton = page.getByTestId('scenarios-manage-round-trips-button');
    this.roundTripsModalPage = page.getByTestId('round-trips-modal');
    this.oneWaysColumnCard = page.getByTestId('one-ways-column').getByTestId('round-trips-card');
    this.roundTripsCards = page.getByTestId('round-trips-card');
    this.roundTripPairs = page.getByTestId('round-trips-pair');
    this.roundTripPairCards = this.roundTripPairs.getByTestId('round-trips-card');
    this.toDoColumnCard = page.getByTestId('todo-column').getByTestId('round-trips-card');
    this.oneWaysColumnTitle = page.getByTestId('one-ways-title');
    this.oneWaysItemCount = page.getByTestId('one-ways-item-count');
    this.roundTripColumnTitle = page.getByTestId('round-trips-title');
    this.roundTripItemCount = page.getByTestId('round-trips-item-count');
    this.toDoColumnTitle = page.getByTestId('todo-title');
    this.toDoItemCount = page.getByTestId('todo-item-count');
    this.saveRoundTripsButton = page.getByTestId('round-trips-save-button');
    this.cancelRoundTripsButton = page.getByTestId('round-trips-cancel-button');
    this.roundTripFilterField = page.getByTestId('round-trips-filter-input');
  }

  async openRoundTripModal() {
    await this.timetableBoardWrapperMenuButton.click();
    await this.manageRoundTripsButton.click();
    await expect(this.roundTripsModalPage).toBeVisible();
  }

  async cancelRoundTripModal() {
    await this.cancelRoundTripsButton.click();
    await expect(this.roundTripsModalPage).not.toBeVisible();
  }

  async verifyRoundTripsModalElements(
    todoTranslation: string,
    oneWayTranslation: string,
    roundTripTranslation: string
  ) {
    await Promise.all([
      expect(this.oneWaysColumnTitle).toBeVisible(),
      expect(this.roundTripColumnTitle).toBeVisible(),
      expect(this.toDoColumnTitle).toBeVisible(),
      expect(this.saveRoundTripsButton).toBeVisible(),
      expect(this.cancelRoundTripsButton).toBeVisible(),
      expect(this.roundTripFilterField).toBeVisible(),
    ]);
    await Promise.all([
      expect(this.toDoColumnTitle).toHaveText(todoTranslation),
      expect(this.oneWaysColumnTitle).toHaveText(oneWayTranslation),
      expect(this.roundTripColumnTitle).toHaveText(roundTripTranslation),
    ]);
  }

  async assertRoundTripColumnCounts({
    expectedToDoCount,
    expectedOneWayCount,
    expectedRoundTripCount,
  }: {
    expectedToDoCount: number;
    expectedOneWayCount: number;
    expectedRoundTripCount: number;
  }): Promise<void> {
    await Promise.all([
      expect(this.toDoItemCount).toBeVisible(),
      expect(this.oneWaysItemCount).toBeVisible(),
      expect(this.roundTripItemCount).toBeVisible(),
    ]);

    await Promise.all([
      expect(this.toDoItemCount).toHaveText(String(expectedToDoCount)),
      expect(this.oneWaysItemCount).toHaveText(String(expectedOneWayCount)),
      expect(this.roundTripItemCount).toHaveText(String(expectedRoundTripCount)),
    ]);

    await Promise.all([
      expect(this.toDoColumnCard).toHaveCount(expectedToDoCount),
      expect(this.oneWaysColumnCard).toHaveCount(expectedOneWayCount),
      expect(this.roundTripPairCards).toHaveCount(expectedRoundTripCount * 2), // each pair has 2 cards
    ]);
  }
}

export default RoundTripPage;
