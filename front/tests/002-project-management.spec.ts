import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type { Project } from 'common/api/osrdEditoastApi';

import projectData from './assets/operationStudies/project.json';
import { deleteApiRequest, getApiRequest, postApiRequest } from './assets/utils';
import PlaywrightCommonPage from './pages/common-page-model';
import { PlaywrightHomePage } from './pages/home-page-model';
import { ProjectPage } from './pages/project-page-model';

let project: Project;

test.beforeEach(async () => {
  project = await postApiRequest('/api/projects/', {
    ...projectData,
    name: `${projectData.name} ${uuidv4()}`,
    budget: 1234567890,
  });
});

test.afterEach(async () => {
  await deleteApiRequest(`/api/projects/${project.id}/`);
});

test.describe('Test if operationnal study : project workflow is working properly', () => {
  test('Create a new project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await expect(projectPage.getAddProjectBtn).toBeVisible();
    await projectPage.openProjectModalCreation();

    const projectName = `${projectData.name} ${uuidv4()}`;
    await projectPage.setProjectName(projectName);

    await projectPage.setProjectDescription(projectData.description);

    await projectPage.setProjectObjectives(projectData.objectives);

    await projectPage.setProjectFunder(projectData.funders);

    await projectPage.setProjectBudget(projectData.budget);

    await commonPage.setTag(projectData.tags[0]);
    await commonPage.setTag(projectData.tags[1]);
    await commonPage.setTag(projectData.tags[2]);

    const createButton = playwrightHomePage.page.getByTestId('createProject');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/projects/*');
    expect(await projectPage.getProjectName.textContent()).toContain(projectName);
    expect(await projectPage.getProjectDescription.textContent()).toContain(
      projectData.description
    );
    const objectives = await projectPage.getProjectObjectives.textContent();
    expect(objectives).not.toEqual(null);
    if (objectives !== null)
      expect(objectives.replace(/[^A-Za-z0-9]/g, '')).toContain(
        (project.objectives ?? "").replace(/[^A-Za-z0-9]/g, '')
      );
    expect(await projectPage.getProjectFinancialsInfos.textContent()).toContain(
      projectData.funders
    );
    const budget = await projectPage.getProjectFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain(projectData.budget);
    const tags = await projectPage.getProjectTags.textContent();
    expect(tags).toContain(projectData.tags.join(''));

    const projects = await getApiRequest('/api/projects/');
    const actualTestProject = projects.results.find((p: Project) => p.name === projectName);

    const deleteProject = await deleteApiRequest(`/api/projects/${actualTestProject.id}/`);
    expect(deleteProject.status()).toEqual(204);
  });

  test(' update a project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await page.goto('/operational-studies/projects');

    await projectPage.openProjectByTestId(project.name);

    await projectPage.openProjectModalUpdate();

    await projectPage.setProjectName(`${project.name} (updated)`);

    await projectPage.setProjectDescription(`${project.description} (updated)`);

    await projectPage.setProjectObjectives(`updated`);

    await projectPage.setProjectFunder(`${project.funders} (updated)`);

    await projectPage.setProjectBudget('123456789');

    await commonPage.setTag('update-tag');

    await projectPage.clickProjectUpdateConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(`${project.name} (updated)`);

    expect(await projectPage.getProjectName.innerText()).toContain(`${project.name} (updated)`);
    expect(await projectPage.getProjectDescription.textContent()).toContain(
      `${project.description} (updated)`
    );
    expect(await projectPage.getProjectObjectives.textContent()).toContain('updated');
    expect(await projectPage.getProjectFinancialsInfos.textContent()).toContain(
      `${project.funders} (updated)`
    );
    const budget = await projectPage.getProjectFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain('123456789');
    expect(await projectPage.getProjectTags.textContent()).toContain(
      `${project.tags.join('')}update-tag`
    );

    const deleteProject = await deleteApiRequest(`/api/projects/${project.id}/`);
    expect(deleteProject.status()).toEqual(204);
  });

  test('Delete a project', async ({ page }) => {
    const projectPage = new ProjectPage(page);

    await page.goto('/operational-studies/projects');

    await projectPage.clickProjectByName(project.name);
    await projectPage.checkLabelProjectSelected();
    await expect(projectPage.getProjectDeleteBtn).not.toBeEmpty();
    await projectPage.clickProjectDeleteBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).toBeVisible();
    await projectPage.clickProjectDeleteConfirmBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).not.toBeVisible();
    await expect(projectPage.getProjectDeleteBtn).not.toBeVisible();
    await expect(projectPage.getProjectByName(project.name)).not.toBeVisible();
  });
});
