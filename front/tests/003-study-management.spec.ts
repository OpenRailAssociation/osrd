import { test, expect } from './baseFixtures';
import { v4 as uuidv4 } from 'uuid';
import { Project, Study } from 'common/api/osrdEditoastApi';
import { PlaywrightHomePage } from './pages/home-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import { StudyPage } from './pages/study-page-model';
import { ProjectPage } from './pages/project-page-model';
import PlaywrightCommonPage from './pages/common-page-model';
import { deleteApiRequest, postApiRequest } from './assets/utils';

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

test.describe('Test if operationnal study: study creation workflow is working properly', () => {
  test('Create a new study', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(newProjectData.name);

    expect(studyPage.getAddStudyBtn).toBeVisible();
    await studyPage.openStudyCreationModal();

    const studyName = `${study.name} ${uuidv4()}`;
    await studyPage.setStudyName(studyName);

    await studyPage.setStudyTypeByText(study.type);

    await studyPage.setStudyStatusByText(study.state);

    await studyPage.setStudyDescription(study.description);

    const todayDateISO = new Date().toISOString().split('T')[0];
    await studyPage.setStudyStartDate(todayDateISO);

    await studyPage.setStudyEstimatedEndDate(todayDateISO);

    await studyPage.setStudyEndDate(todayDateISO);

    await studyPage.setStudyServiceCode(study.service_code);

    await studyPage.setStudyBusinessCode(study.business_code);

    await studyPage.setStudyBudget(study.budget);

    await commonPage.setTag(project.tags[0]);
    await commonPage.setTag(project.tags[1]);
    await commonPage.setTag(project.tags[2]);

    const createButton = playwrightHomePage.page.getByTestId('createStudy');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/studies/*');
    expect(await studyPage.getStudyName.textContent()).toContain(studyName);
    expect(await studyPage.getStudyDescription.textContent()).toContain(study.description);
    expect(await studyPage.getStudyType.textContent()).toContain(study.type);
    expect(await studyPage.getStudyState.last().textContent()).toContain(study.state);

    expect(await studyPage.getStudyFinancialsInfos.first().textContent()).toContain(
      study.service_code
    );
    expect(await studyPage.getStudyFinancialsInfos.last().textContent()).toContain(
      study.business_code
    );
    const budget = await studyPage.getStudyFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain(study.budget);
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain(study.tags.join(''));
  });

  test(' update a study', async ({ page }) => {
    const newStudyData: Study = await postApiRequest(`/projects/${newProjectData.id}/studies/`, {
      ...study,
      name: `${study.name} ${uuidv4()}`,
      budget: 1234567890,
      project: newProjectData.id,
    });

    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);
    const projectPage = new ProjectPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(newProjectData.name);

    await studyPage.openStudyByTestId(newStudyData.name);

    await studyPage.openStudyModalUpdate();

    await studyPage.setStudyName(`${newStudyData.name} (updated)`);

    await studyPage.setStudyTypeByText('Exploitabilité');

    await studyPage.setStudyStatusByText('En cours');

    const tomorrowDateISO = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await studyPage.setStudyDescription(`${newStudyData.description} (updated)`);

    await studyPage.setStudyStartDate(tomorrowDateISO);

    await studyPage.setStudyEstimatedEndDate(tomorrowDateISO);

    await studyPage.setStudyEndDate(tomorrowDateISO);

    await studyPage.setStudyServiceCode(`${newStudyData.service_code} (updated)`);

    await studyPage.setStudyBusinessCode(`${newStudyData.business_code} (updated)`);

    await studyPage.setStudyBudget('123456789');

    await commonPage.setTag('update-tag');

    await studyPage.clickStudyUpdateConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(newProjectData.name);

    await studyPage.openStudyByTestId(`${newStudyData.name} (updated)`);
    expect(await studyPage.getStudyName.textContent()).toContain(`${newStudyData.name} (updated)`);
    expect(await studyPage.getStudyDescription.textContent()).toContain(
      `${newStudyData.description} (updated)`
    );
    expect(await studyPage.getStudyType.textContent()).toContain('Exploitabilité');
    expect(await studyPage.getStudyState.last().textContent()).toContain('En cours');
    expect(await studyPage.getStudyFinancialsInfos.first().textContent()).toContain(
      `${newStudyData.service_code} (updated)`
    );
    expect(await studyPage.getStudyFinancialsInfos.last().textContent()).toContain(
      `${newStudyData.business_code} (updated)`
    );
    const budget = await studyPage.getStudyFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain('123456789');
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain('update-tag');
  });

  test('Delete a study', async ({ page }) => {
    const newStudyData: Study = await postApiRequest(`/projects/${newProjectData.id}/studies/`, {
      ...study,
      name: `${study.name} ${uuidv4()}`,
      budget: 1234567890,
      project: newProjectData.id,
    });

    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);
    const projectPage = new ProjectPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await projectPage.openProjectByTestId(newProjectData.name);

    await studyPage.openStudyByTestId(newStudyData.name);

    await studyPage.openStudyModalUpdate();

    await studyPage.clickStudyDeleteConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await expect(studyPage.getStudyByName(newStudyData.name)).not.toBeVisible();
  });
});
