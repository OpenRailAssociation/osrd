import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import project from './assets/operationStudies/project.json';
import { ProjectPage } from './pages/project-page-model';

test.describe('Test is operationnal study  : project workflow is working properly', () => {
  test('Create a new project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    const addProject = playwrightHomePage.page.getByRole('button', { name: 'Créer un projet' });
    expect(addProject).not.toEqual(null);
    await addProject.click();
    const projectNameInput = playwrightHomePage.page.locator('#projectInputName');
    await projectNameInput.fill(project.name);
    const projectDescriptionInput = playwrightHomePage.page.locator('#projectDescription');
    await projectDescriptionInput.fill(project.description);
    const projectObjectiveInput = playwrightHomePage.page.locator('#projectObjectives');
    await projectObjectiveInput.fill(project.objectives);
    const projectFunders = playwrightHomePage.page.locator('#projectInputFunders');
    await projectFunders.fill(project.funders);
    const projectBudget = playwrightHomePage.page.locator('#projectInputBudget');
    await projectBudget.fill(project.budget);
    const tagsInput = playwrightHomePage.page.getByTestId('chips-input');
    await tagsInput.fill(project.tags[0]);
    await tagsInput.press('Enter');
    await tagsInput.fill(project.tags[1]);
    await tagsInput.press('Enter');
    await tagsInput.fill(project.tags[2]);
    await tagsInput.press('Enter');
    const createButton = playwrightHomePage.page.getByText('Créer le projet');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/project');
    expect(await projectPage.getProjectName.textContent()).toContain(project.name);
    expect(await projectPage.getProjectDescription.textContent()).toContain(project.description);
    const objectives = await projectPage.getProjectObjectives.textContent();
    expect(objectives).not.toEqual(null);
    if (objectives !== null)
      expect(objectives.replace(/[^A-Za-z0-9]/g, '')).toContain(
        project.objectives.replace(/[^A-Za-z0-9]/g, '')
      );
    expect(await projectPage.getProjectFinancialsInfos.textContent()).toContain(project.funders);
    const budget = await projectPage.getProjectFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain(project.budget);
    const tags = await projectPage.getProjectTags.textContent();
    expect(tags).toContain(project.tags[0]);
    expect(tags).toContain(project.tags[1]);
    expect(tags).toContain(project.tags[2]);
  });
});
