import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './pages/home-page-model';
import project from './assets/operationStudies/project.json';

import { ProjectPage } from './pages/project-page-model';

test.describe('Test is operationnal study: study creation workflow is working properly', () => {
  test('Delete project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.clickProjectByName(project.name);
    await projectPage.checkLabelProjectSelected('1 projet sélectionné');
    // don't move this line up, at this place we are sure that project list has been loaded
    const nbProject = await page.locator('div.projects-list-project-card').count();
    await expect(projectPage.getProjectDeleteBtn).toBeVisible();
    await projectPage.clickProjectDeleteBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).toBeVisible();
    await projectPage.clickProjectDeleteConfirmBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).not.toBeVisible();
    await expect(projectPage.getProjectDeleteBtn).not.toBeVisible();

    // Check that there is one project missing (and so deleted)
    const nbProjectAfter = await page.locator('div.projects-list-project-card').count();
    expect(nbProjectAfter).toBe(nbProject - 1);
  });
});
