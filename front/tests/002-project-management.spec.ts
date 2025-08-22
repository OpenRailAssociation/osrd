import type { Project } from 'common/api/osrdEditoastApi';

import test from './logging-fixture';
import ProjectPage from './pages/operational-studies/project-page';
import { generateUniqueName } from './utils';
import readJsonFile from './utils/file-utils';
import { createProject } from './utils/setup-utils';
import { deleteProject } from './utils/teardown-utils';
import type { ProjectData } from './utils/types';

const projectData: ProjectData = readJsonFile('tests/assets/operation-studies/project.json');

test.describe('Validate the Operational Study Project workflow', () => {
  let projectPage: ProjectPage;

  let project: Project;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
  });

  /** *************** Test 1 **************** */
  test('Create a new project', async ({ page }) => {
    const projectName = generateUniqueName(projectData.name);

    await test.step('Go to projects page', async () => {
      await page.goto('/operational-studies/projects');
    });

    await test.step('Create project via UI', async () => {
      await projectPage.createProject({
        name: projectName,
        description: projectData.description,
        objectives: projectData.objectives,
        funders: projectData.funders,
        budget: projectData.budget,
        tags: projectData.tags,
      });
    });

    await test.step('Validate created project data', async () => {
      await projectPage.validateProjectData({
        name: projectName,
        description: projectData.description,
        objectives: projectData.objectives,
        funders: projectData.funders,
        budget: projectData.budget,
        tags: projectData.tags,
      });
    });

    await test.step('Delete created project', async () => {
      await deleteProject(projectName);
    });
  });

  /** *************** Test 2 **************** */
  test('Update an existing project', async ({ page }) => {
    await test.step('Create a base project', async () => {
      project = await createProject(generateUniqueName(projectData.name));
    });

    await test.step('Open created project from projects list', async () => {
      await page.goto('/operational-studies/projects');
      await projectPage.openProjectByTestId(project.name);
    });

    await test.step('Update than save project details', async () => {
      await projectPage.updateProject({
        name: `${project.name} (updated)`,
        description: `${project.description} (updated)`,
        objectives: `${projectData.objectives} (updated)`,
        funders: `${project.funders} (updated)`,
        budget: '123456789',
        tags: ['update-tag'],
      });
    });

    await test.step('Navigate back to operational studies page via home page', async () => {
      await projectPage.backToHomePage();
      await projectPage.goToOperationalStudiesPage();
    });

    await test.step('Reopen updated project and validate data', async () => {
      await projectPage.openProjectByTestId(`${project.name} (updated)`);
      await projectPage.validateProjectData({
        name: `${project.name} (updated)`,
        description: `${project.description} (updated)`,
        objectives: `${projectData.objectives} (updated)`,
        funders: `${project.funders} (updated)`,
        budget: '123456789',
        tags: ['update-tag'],
      });
    });

    await test.step('Delete updated project', async () => {
      await deleteProject(`${project.name} (updated)`);
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a project', async ({ page }) => {
    await test.step('Create a project to delete', async () => {
      project = await createProject(generateUniqueName(projectData.name));
    });

    await test.step('Open project and delete it', async () => {
      await page.goto('/operational-studies/projects');
      await projectPage.openProjectByTestId(project.name);
      await projectPage.deleteProject(project.name);
    });
  });
});
