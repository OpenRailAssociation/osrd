import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
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
    await expect(projectPage.getProjectDeleteBtn).toBeVisible();
    await projectPage.clickProjectDeleteBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).toBeVisible();
    await projectPage.clickProjectDeleteConfirmBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).not.toBeVisible();
    await expect(projectPage.getProjectDeleteBtn).not.toBeVisible();
    await expect(projectPage.getProjectByName(project.name)).not.toBeVisible();
  });
});
