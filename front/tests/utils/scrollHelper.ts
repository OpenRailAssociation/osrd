import { type Page } from 'playwright';

interface ScrollOptions {
  stepSize?: number;
  timeout?: number;
  scrollOffsetThreshold?: number;
}

/**
 * Scroll a specified container element horizontally by the given step size, with a delay between steps.
 *
 * @param page - The Playwright page object.
 * @param containerSelector - The CSS selector for the scrollable container element.
 * @param ScrollOptions - Optional scroll configuration including step size, timeout, and scroll offset threshold.
 * @returns {Promise<void>} - Resolves once the container has been fully scrolled.
 */
export const scrollHorizontally = async (
  page: Page,
  containerSelector: string,
  { stepSize = 300, timeout = 20, scrollOffsetThreshold = 200 }: ScrollOptions = {}
): Promise<void> => {
  // Locate the scrollable container on the page
  await page.waitForSelector(containerSelector);
  const container = await page.evaluateHandle(
    (selector: string) => document.querySelector(selector),
    containerSelector
  );

  // Get the scrollable width and visible width of the container
  const { scrollWidth, clientWidth } = await page.evaluate(
    (containerElement) =>
      containerElement
        ? {
            scrollWidth: containerElement.scrollWidth,
            clientWidth: containerElement.clientWidth,
          }
        : { scrollWidth: 0, clientWidth: 0 }, // Default if no container found
    container
  );

  // Exit early if there's a little or no scrollable content
  if (scrollWidth <= clientWidth + scrollOffsetThreshold) {
    await container.dispose();
    return;
  }

  // Scroll the container in steps until the end of the content is reached
  let currentScrollPosition = 0;
  while (currentScrollPosition < scrollWidth) {
    await page.evaluate(
      ({ containerElement, step }) => {
        if (containerElement) {
          containerElement.scrollLeft += step; // Scroll by step size
        }
      },
      { containerElement: container, step: stepSize }
    );

    await page.waitForTimeout(timeout);
    currentScrollPosition += stepSize;
  }

  // Clean up the handle after scrolling is complete
  await container.dispose();
};

/**
 * Scroll a specified container element vertically by a small step.
 *
 * @param page - The Playwright page object.
 * @param containerSelector - The CSS selector for the scrollable container element.
 * @param ScrollOptions - Optional scroll configuration including step size and scroll offset threshold.
 * @returns {Promise<void>} - Resolves once a small scroll action is performed.
 */
export const scrollVertically = async (
  page: Page,
  containerSelector: string,
  { stepSize = 30, scrollOffsetThreshold = 47 }: ScrollOptions = {}
): Promise<void> => {
  // Locate the scrollable container on the page
  await page.waitForSelector(containerSelector);
  const container = await page.evaluateHandle(
    (selector: string) => document.querySelector(selector),
    containerSelector
  );

  // Retrieve the scrollable height and visible height of the container
  const { scrollHeight, clientHeight } = await page.evaluate(
    (containerElement) =>
      containerElement
        ? {
            scrollHeight: containerElement.scrollHeight,
            clientHeight: containerElement.clientHeight,
          }
        : { scrollHeight: 0, clientHeight: 0 },
    container
  );

  // Exit early if there's a little or no scrollable content
  if (scrollHeight <= clientHeight + scrollOffsetThreshold) {
    await container.dispose();
    return;
  }

  // Perform a small vertical scroll
  await page.evaluate(
    ({ containerElement, step }) => {
      if (containerElement) {
        containerElement.scrollTop += step;
      }
    },
    { containerElement: container, step: stepSize }
  );

  // Clean up the handle after scrolling is complete
  await container.dispose();
};
