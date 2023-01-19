import {test, expect} from '@playwright/test';

// This test will run in all three browsers because
// it is not tagged with `@chromium`, `@firefox` or `@webkit`.
//This test will test if all mandatory elements are present on the page

test('testing if all mandatory elements for configure a simulation are loaded in grilles horaires app', async ({page}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Grilles horaires Grilles horaires' }).click();
  //testing if all mandatory elements for configure a simulation are loaded
  expect(page.getByTestId('infraselector-button')).not.toEqual(null);
  expect(page.getByTestId('rollingdtock-selector')).not.toEqual(null);
  expect(page.getByTestId('timetableSelector')).not.toEqual(null);
  expect(page.getByTestId('speed-limit-by-tag-selector')).not.toEqual(null);
  //Here is how to create a locator for a specific element
  const itinerary = await page.getByTestId('itinerary');
  expect(itinerary).not.toEqual(null);
  //here is how get locator inside another locator
  expect(itinerary.getByTestId('display-itinerary')).not.toEqual(null);
  //here is how you can chain locators
  expect(itinerary.getByTestId('display-itinerary').getByTestId('itinerary-origin')).not.toEqual(null);
  expect(itinerary.getByTestId('display-itinerary').getByTestId('itinerary-vias')).not.toEqual(null);
  expect(itinerary.getByTestId('display-itinerary').getByTestId('itinerary-destination')).not.toEqual(null);
  expect(page.getByTestId('add-train-labels')).not.toEqual(null);
  expect(page.getByTestId('add-train-schedules')).not.toEqual(null);
  expect(page.getByTestId('map')).not.toEqual(null);

});
