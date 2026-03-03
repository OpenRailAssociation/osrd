import type { Project } from 'common/api/osrdEditoastApi';

import {
  PROJECT_DATA,
  PROJECT_URLS,
  UPDATED_PROJECT_DATA,
} from '../../assets/operation-studies/project-const';
import test from '../../page-object-fixture';
import { generateUniqueName } from '../../utils';
import { createProject } from '../../utils/setup-utils';
import { deleteProject } from '../../utils/teardown-utils';

test.describe('@op @project @management', () => {
  let project: Project;
  const createdProjects: string[] = [];

  test.afterAll(async () => {
    if (!createdProjects.length) return;
    await Promise.allSettled(createdProjects.map((name) => deleteProject(name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new project', async ({ page, projectPage }) => {
    const projectName = generateUniqueName(PROJECT_DATA.name);
    createdProjects.push(projectName);

    const projectDetails = { ...PROJECT_DATA, name: projectName };

    await test.step('Go to projects page', async () => {
      await page.goto(PROJECT_URLS.list);
    });

    await test.step('Create project via UI', async () => {
      await projectPage.createProject(projectDetails);
    });

    await test.step('Validate created project data', async () => {
      await projectPage.validateProjectData(projectDetails);
    });
  });

  /** *************** Test 2 **************** */
  test('Update an existing project', async ({ page, projectPage }) => {
    const baseName = generateUniqueName(PROJECT_DATA.name);
    const updatedName = `${baseName} (updated)`;
    createdProjects.push(baseName, updatedName);

    const updatedDetails = { ...UPDATED_PROJECT_DATA, name: updatedName };

    await test.step('Create a base project', async () => {
      project = await createProject(baseName);
    });

    await test.step('Open created project from projects list', async () => {
      await page.goto(PROJECT_URLS.list);
      await projectPage.openProjectByName(project.name);
    });

    await test.step('Update and save project details', async () => {
      await projectPage.updateProject(updatedDetails);
    });

    await test.step('Navigate back to operational studies page via home page', async () => {
      await projectPage.backToHomePage();
      await projectPage.goToOperationalStudiesPage();
    });

    await test.step('Reopen updated project and validate data', async () => {
      await projectPage.openProjectByName(updatedName);
      await projectPage.validateProjectData(updatedDetails);
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a project', async ({ page, projectPage }) => {
    const projectName = generateUniqueName(PROJECT_DATA.name);
    createdProjects.push(projectName);

    await test.step('Create a project to delete', async () => {
      project = await createProject(projectName);
    });

    await test.step('Open project and delete it', async () => {
      await page.goto(PROJECT_URLS.list);
      await projectPage.openProjectByName(project.name);
      await projectPage.deleteProject(project.name);
    });
  });
});
