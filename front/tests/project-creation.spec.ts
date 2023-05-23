import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import project from './assets/operationStudies/project.json';

test.describe('Test is operationnal study workflow is working properly', () => {
  let playwrightHomePage: PlaywrightHomePage;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    playwrightHomePage = new PlaywrightHomePage(page);
    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
  });

  test('Create a new project', async () => {
    const addProject = playwrightHomePage.page.getByTestId('add-project');
    expect(addProject).not.toEqual(null);
    await addProject.click();
    const projectEditionModal = playwrightHomePage.page.getByTestId('project-edition-modal');
    expect(projectEditionModal).not.toEqual(null);
    const projectNameInput = playwrightHomePage.page.getByTestId('project-name-input');
    projectNameInput.fill(project.name);
    const projectDescriptionInput = playwrightHomePage.page.getByTestId('projectInputDescription');
    projectDescriptionInput.fill(project.description);
    // expect(projectNameInput.inputValue()).toEqual('Test project');
  });
});
