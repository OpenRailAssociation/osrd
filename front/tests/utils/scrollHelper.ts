import { type Page } from 'playwright';

interface ScrollOptions {
  stepSize?: number;
  timeout?: number;
}

const scrollContainer = async (
  page: Page,
  containerSelector: string,
  { stepSize = 300, timeout = 20 }: ScrollOptions = {}
): Promise<void> => {
  // Locate the scrollable container once
  const container = await page.evaluateHandle(
    (selector: string) => document.querySelector(selector),
    containerSelector
  );

  // Ensure the container exists and has scrollable content
  const scrollWidth = await page.evaluate(
    (containerElement) => (containerElement ? containerElement.scrollWidth : 0),
    container
  );

  // Exit early if scrollWidth is 0
  if (scrollWidth === 0) {
    await container.dispose();
    return;
  }

  // Scroll in steps
  let currentScrollPosition = 0;
  while (currentScrollPosition < scrollWidth) {
    await page.evaluate(
      ({ containerElement, step }) => {
        if (containerElement) {
          containerElement.scrollLeft += step;
        }
      },
      { containerElement: container, step: stepSize }
    );

    await page.waitForTimeout(timeout);
    currentScrollPosition += stepSize;
  }

  await container.dispose();
};

export default scrollContainer;
