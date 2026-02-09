import type { Project } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { generateUniqueName } from '../../utils';
import { readJsonFile } from '../../utils/file-utils';
import { createProject } from '../../utils/setup-utils';
import { deleteProject } from '../../utils/teardown-utils';
import type { ProjectData } from '../../utils/types';

const projectData: ProjectData = readJsonFile('tests/assets/operation-studies/project.json');

test.describe('@op @project @management', () => {
  let project: Project;

  const createdProjects: string[] = [];

  test.afterAll(async () => {
    if (!createdProjects.length) return;
    const projectsToDelete = [...createdProjects];
    await Promise.allSettled(projectsToDelete.map((name) => deleteProject(name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new project', async ({ page, projectPage }) => {
    const projectName = generateUniqueName(projectData.name);
    createdProjects.push(projectName);

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
  });

  /** *************** Test 2 **************** */
  test('Update an existing project', async ({ page, projectPage }) => {
    const baseName = generateUniqueName(projectData.name);
    const updatedName = `${baseName} (updated)`;
    createdProjects.push(baseName, updatedName);

    await test.step('Create a base project', async () => {
      project = await createProject(baseName);
    });

    await test.step('Open created project from projects list', async () => {
      await page.goto('/operational-studies/projects');
      await projectPage.openProjectByTestId(project.name);
    });

    await test.step('Update and save project details', async () => {
      await projectPage.updateProject({
        name: updatedName,
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
      await projectPage.openProjectByTestId(updatedName);
      await projectPage.validateProjectData({
        name: updatedName,
        description: `${project.description} (updated)`,
        objectives: `${projectData.objectives} (updated)`,
        funders: `${project.funders} (updated)`,
        budget: '123456789',
        tags: ['update-tag'],
      });
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a project', async ({ page, projectPage }) => {
    const projectName = generateUniqueName(projectData.name);
    createdProjects.push(projectName);

    await test.step('Create a project to delete', async () => {
      project = await createProject(projectName);
    });

    await test.step('Open project and delete it', async () => {
      await page.goto('/operational-studies/projects');
      await projectPage.openProjectByTestId(project.name);
      await projectPage.deleteProject(project.name);
    });
  });
});
