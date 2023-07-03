import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import scenario from './assets/operationStudies/scenario.json';

test.describe('Test is operationnal study : scenario creation workflow is working properly', () => {
  let playwrightHomePage: PlaywrightHomePage;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    playwrightHomePage = new PlaywrightHomePage(page);
    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    const projectCardButton = playwrightHomePage.page
      .getByTestId('Test e2e projet')
      .getByRole('button', { name: 'Ouvrir' });
    await projectCardButton.click();
    const studyCardButton = playwrightHomePage.page
      .getByTestId('Test e2e étude')
      .getByRole('button', { name: 'Ouvrir' });
    await studyCardButton.click();
  });

  test('Create a new scenario', async () => {
    const addScenario = playwrightHomePage.page.getByRole('button', { name: 'Créer un scénario' });
    expect(addScenario).not.toEqual(null);
    await addScenario.click();
    const scenarioNameInput = playwrightHomePage.page.locator('#scenarioInputName');
    await scenarioNameInput.fill(scenario.name);
    const scenarioDescriptionInput = playwrightHomePage.page.locator('#scenarioDescription');
    await scenarioDescriptionInput.fill(scenario.description);
    const electricProfileInput = playwrightHomePage.page.locator('.input-group');
    await electricProfileInput.click();
    await playwrightHomePage.page
      .locator('[id="-selecttoggle"]')
      .getByText(`${scenario.electric_profile_set}`)
      .click();
    const tagsInput = playwrightHomePage.page.getByTestId('chips-input');
    await tagsInput.fill(scenario.tags[0]);
    await tagsInput.press('Enter');
    await tagsInput.fill(scenario.tags[1]);
    await tagsInput.press('Enter');
    await tagsInput.fill(scenario.tags[2]);
    await tagsInput.press('Enter');
    await playwrightHomePage.page.getByTestId('infraslist-item-3').click();
    const createButton = playwrightHomePage.page.getByText('Créer le scénario');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/scenario');
    expect(
      await playwrightHomePage.page.locator('.scenario-details-name .scenario-name').textContent()
    ).toContain(scenario.name);
    expect(
      await playwrightHomePage.page.locator('.scenario-details-description').textContent()
    ).toContain(scenario.description);
    expect(await playwrightHomePage.page.locator('.scenario-infra-name').textContent()).toContain(
      scenario.electric_profile_set
    );
  });
});
