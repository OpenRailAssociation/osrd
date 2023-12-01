import { test, expect } from './baseFixtures';
import { v4 as uuidv4 } from 'uuid';
import { Project } from 'common/api/osrdEditoastApi';
import { PlaywrightHomePage } from './pages/home-page-model';
import project from './assets/operationStudies/project.json';
import { ProjectPage } from './pages/project-page-model';
import PlaywrightCommonPage from './pages/common-page-model';
import { deleteApiRequest, getApiRequest, postApiRequest } from './assets/utils';

let newProjectData: Project;

test.beforeEach(async () => {
  newProjectData = await postApiRequest('/projects/', {
    ...project,
    name: `${project.name} ${uuidv4()}`,
    budget: 1234567890,
  });
});

test.afterEach(async () => {
  await deleteApiRequest(`/projects/${newProjectData.id}/`);
});

test.describe('Test if operationnal study  : project workflow is working properly', () => {
  test('Create a new project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await expect(projectPage.getAddProjectBtn).toBeVisible();
    await projectPage.openProjectModalCreation();

    const projectName = `${project.name} ${uuidv4()}`;
    await projectPage.setProjectName(projectName);

    await projectPage.setProjectDescription(project.description);

    await projectPage.setProjectObjectives(project.objectives);

    await projectPage.setProjectFunder(project.funders);

    await projectPage.setProjectBudget(project.budget);

    await commonPage.setTag(project.tags[0]);
    await commonPage.setTag(project.tags[1]);
    await commonPage.setTag(project.tags[2]);

    const createButton = playwrightHomePage.page.getByTestId('createProject');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/projects/*');
    expect(await projectPage.getProjectName.textContent()).toContain(projectName);
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

    const projects = await getApiRequest('/projects/');
    const actualTestProject = projects.results.find((p: Project) => p.name === projectName);

    const deleteProject = await deleteApiRequest(`/projects/${actualTestProject.id}/`);
    expect(deleteProject.status()).toEqual(204);
  });

  test(' update a project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(newProjectData.name);

    await projectPage.openProjectModalUpdate();

    await projectPage.setProjectName(`${newProjectData.name} (updated)`);

    await projectPage.setProjectDescription(`${newProjectData.description} (updated)`);

    await projectPage.setProjectObjectives(`updated`);

    await projectPage.setProjectFunder(`${newProjectData.funders} (updated)`);

    await projectPage.setProjectBudget('123456789');

    await commonPage.setTag('update-tag');

    await projectPage.clickProjectUpdateConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(`${newProjectData.name} (updated)`);

    expect(await projectPage.getProjectName.innerText()).toContain(
      `${newProjectData.name} (updated)`
    );
    expect(await projectPage.getProjectDescription.textContent()).toContain(
      `${newProjectData.description} (updated)`
    );
    expect(await projectPage.getProjectObjectives.textContent()).toContain('updated');
    expect(await projectPage.getProjectFinancialsInfos.textContent()).toContain(
      `${newProjectData.funders} (updated)`
    );
    const budget = await projectPage.getProjectFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain('123456789');
    expect(await projectPage.getProjectTags.textContent()).toContain(
      `${project.tags.join('')}update-tag`
    );

    const deleteProject = await deleteApiRequest(`/projects/${newProjectData.id}/`);
    expect(deleteProject.status()).toEqual(204);
  });

  test('Delete a project', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.clickProjectByName(newProjectData.name);
    await projectPage.checkLabelProjectSelected();
    await expect(projectPage.getProjectDeleteBtn).not.toBeEmpty();
    await projectPage.clickProjectDeleteBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).toBeVisible();
    await projectPage.clickProjectDeleteConfirmBtn();
    await expect(projectPage.getProjectDeleteConfirmBtn).not.toBeVisible();
    await expect(projectPage.getProjectDeleteBtn).not.toBeVisible();
    await expect(projectPage.getProjectByName(newProjectData.name)).not.toBeVisible();
  });
});
