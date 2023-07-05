import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import project from './assets/operationStudies/project.json';
import { ProjectPage } from './pages/project-page-model';
import PlaywrightCommonPage from './pages/common-page-model';

test.describe('Test is operationnal study  : project workflow is working properly', () => {
  test('Create a new project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await expect(projectPage.getAddProjectBtn).toBeVisible();
    await projectPage.openProjectModalCreation();
    await projectPage.setProjectName(project.name);
    await projectPage.setProjectDescription(project.description);

    await projectPage.setProjectObjectives(project.objectives);

    await projectPage.setProjectFunder(project.funders);

    await projectPage.setProjectBudget(project.budget);

    await commonPage.setTag(project.tags[0]);
    await commonPage.setTag(project.tags[1]);
    await commonPage.setTag(project.tags[2]);

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
    expect(tags).toContain(project.tags.join(''));
  });
});
