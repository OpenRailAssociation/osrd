import { type Locator, type Page, expect } from '@playwright/test';

import OperationalStudiesPage from './operational-studies-page';
import type { RoundTripCardExpected } from '../../utils/types';

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

  private readonly roundTripCardName: Locator;

  private readonly roundTripCardInterval: Locator;

  private readonly roundTripCardStops: Locator;

  private readonly roundTripCardOrigin: Locator;

  private readonly roundTripCardDestination: Locator;

  private readonly roundTripCardStartTime: Locator;

  private readonly roundTripCardRequestedArrivalTime: Locator;

  private readonly intermediateStopsTooltip: Locator;

  private readonly intermediateStopTooltipItem: Locator;

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
    this.roundTripCardName = page.getByTestId('round-trips-card-name');
    this.roundTripCardInterval = page.getByTestId('round-trips-card-interval');
    this.roundTripCardStops = page.getByTestId('round-trips-card-stops');
    this.roundTripCardOrigin = page.getByTestId('round-trips-card-origin');
    this.roundTripCardDestination = page.getByTestId('round-trips-card-destination');
    this.roundTripCardStartTime = page.getByTestId('round-trips-card-start-time');
    this.roundTripCardRequestedArrivalTime = page.getByTestId(
      'round-trips-card-requested-arrival-time'
    );
    this.intermediateStopsTooltip = page.getByTestId('osrd-tooltip');
    this.intermediateStopTooltipItem = this.intermediateStopsTooltip.getByTestId('tooltip-item');
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

  async verifyRoundTripCardData({
    roundTripCardIndex,
    expectedCard,
  }: {
    roundTripCardIndex: number;
    expectedCard: RoundTripCardExpected;
  }): Promise<void> {
    await expect(this.roundTripsCards.nth(roundTripCardIndex)).toBeVisible();

    const title = this.roundTripCardName.nth(roundTripCardIndex);
    const interval = this.roundTripCardInterval.nth(roundTripCardIndex);
    const stops = this.roundTripCardStops.nth(roundTripCardIndex);
    const origin = this.roundTripCardOrigin.nth(roundTripCardIndex);
    const destination = this.roundTripCardDestination.nth(roundTripCardIndex);
    const startTime = this.roundTripCardStartTime.nth(roundTripCardIndex);
    const requestedArrivalTime = this.roundTripCardRequestedArrivalTime.nth(roundTripCardIndex);

    await Promise.all([
      expect(title).toHaveText(expectedCard.title),
      expect(interval).toHaveText(expectedCard.interval),
      expect(stops).toHaveText(expectedCard.stops),
      expect(origin).toHaveText(expectedCard.origin),
      expect(destination).toHaveText(expectedCard.destination),
      expect(startTime).toHaveText(expectedCard.startTime),
      expect(requestedArrivalTime).toHaveText(expectedCard.requestedArrivalTime),
    ]);
  }

  private async hideOpenTooltip(): Promise<void> {
    if (await this.intermediateStopsTooltip.isVisible()) {
      await this.roundTripsModalPage.hover({ position: { x: 5, y: 5 } });
      await expect(this.intermediateStopsTooltip).toBeHidden();
    }
  }

  async checkIntermediateStopsTooltip({
    roundTripCardIndex,
  }: {
    roundTripCardIndex: number;
  }): Promise<void> {
    const stops = this.roundTripCardStops.nth(roundTripCardIndex);
    await stops.hover();
    await expect(this.intermediateStopsTooltip).toBeVisible();
    const tooltipItemsCount = await this.intermediateStopTooltipItem.count();
    await expect(stops).toHaveText(String(tooltipItemsCount));
    await this.hideOpenTooltip(); // dismiss the tooltip
  }

  async verifyNoTooltipDisplayed({
    roundTripCardIndex,
  }: {
    roundTripCardIndex: number;
  }): Promise<void> {
    const stops = this.roundTripCardStops.nth(roundTripCardIndex);
    await stops.hover({ force: true });
    await expect(this.intermediateStopsTooltip).not.toBeVisible();
  }
}

export default RoundTripPage;
