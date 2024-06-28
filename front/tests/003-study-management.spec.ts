import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type { Project, Study } from 'common/api/osrdEditoastApi';

import studyData from './assets/operationStudies/study.json';
import { getProject, postApiRequest } from './utils/index';
import PlaywrightCommonPage from './pages/common-page-model';
import { PlaywrightHomePage } from './pages/home-page-model';
import { StudyPage } from './pages/study-page-model';

let project: Project;
let study: Study;

test.beforeAll(async () => {
  project = await getProject();
});

test.beforeEach(async () => {
  study = await postApiRequest(`/api/projects/${project.id}/studies/`, {
    ...studyData,
    name: `${studyData.name} ${uuidv4()}`,
    budget: 1234567890,
    project: project.id,
  });
});

test.describe('Test if operationnal study: study creation workflow is working properly', () => {
  test('Create a new study', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await page.goto(`/operational-studies/projects/${project.id}`);

    expect(studyPage.getAddStudyBtn).toBeVisible();
    await studyPage.openStudyCreationModal();

    const studyName = `${studyData.name} ${uuidv4()}`;
    await studyPage.setStudyName(studyName);

    await studyPage.setStudyTypeByText(studyData.type);

    await studyPage.setStudyStatusByText(studyData.state);

    await studyPage.setStudyDescription(studyData.description);

    const todayDateISO = new Date().toISOString().split('T')[0];
    await studyPage.setStudyStartDate(todayDateISO);

    await studyPage.setStudyEstimatedEndDate(todayDateISO);

    await studyPage.setStudyEndDate(todayDateISO);

    await studyPage.setStudyServiceCode(studyData.service_code);

    await studyPage.setStudyBusinessCode(studyData.business_code);

    await studyPage.setStudyBudget(studyData.budget);

    await commonPage.setTag(project.tags[0]);
    await commonPage.setTag(project.tags[1]);
    await commonPage.setTag(project.tags[2]);

    const createButton = playwrightHomePage.page.getByTestId('createStudy');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/studies/*');
    expect(await studyPage.getStudyName.textContent()).toContain(studyName);
    expect(await studyPage.getStudyDescription.textContent()).toContain(studyData.description);
    expect(await studyPage.getStudyType.textContent()).toContain(studyData.type);
    expect(await studyPage.getStudyState.last().textContent()).toContain(studyData.state);

    expect(await studyPage.getStudyFinancialsInfos.first().textContent()).toContain(
      studyData.service_code
    );
    expect(await studyPage.getStudyFinancialsInfos.last().textContent()).toContain(
      studyData.business_code
    );
    const budget = await studyPage.getStudyFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain(studyData.budget);
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain(studyData.tags.join(''));
  });

  test(' update a study', async ({ page }) => {
    const studyPage = new StudyPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    await studyPage.openStudyModalUpdate();

    await studyPage.setStudyName(`${study.name} (updated)`);

    await studyPage.setStudyTypeByText('Exploitabilité');

    await studyPage.setStudyStatusByText('En cours');

    const tomorrowDateISO = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await studyPage.setStudyDescription(`${study.description} (updated)`);

    await studyPage.setStudyStartDate(tomorrowDateISO);

    await studyPage.setStudyEstimatedEndDate(tomorrowDateISO);

    await studyPage.setStudyEndDate(tomorrowDateISO);

    await studyPage.setStudyServiceCode(`${study.service_code} (updated)`);

    await studyPage.setStudyBusinessCode(`${study.business_code} (updated)`);

    await studyPage.setStudyBudget('123456789');

    await commonPage.setTag('update-tag');

    await studyPage.clickStudyUpdateConfirmBtn();

    await page.goto(`/operational-studies/projects/${project.id}`);

    await studyPage.openStudyByTestId(`${study.name} (updated)`);
    expect(await studyPage.getStudyName.textContent()).toContain(`${study.name} (updated)`);
    expect(await studyPage.getStudyDescription.textContent()).toContain(
      `${study.description} (updated)`
    );
    expect(await studyPage.getStudyType.textContent()).toContain('Exploitabilité');
    expect(await studyPage.getStudyState.last().textContent()).toContain('En cours');
    expect(await studyPage.getStudyFinancialsInfos.first().textContent()).toContain(
      `${study.service_code} (updated)`
    );
    expect(await studyPage.getStudyFinancialsInfos.last().textContent()).toContain(
      `${study.business_code} (updated)`
    );
    const budget = await studyPage.getStudyFinancialsAmount.textContent();
    expect(budget).not.toEqual(null);
    if (budget !== null) expect(budget.replace(/[^0-9]/g, '')).toContain('123456789');
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain('update-tag');
  });

  test('Delete a study', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const studyPage = new StudyPage(page);

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    await studyPage.openStudyModalUpdate();

    await studyPage.clickStudyDeleteConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();

    await expect(studyPage.getStudyByName(studyData.name)).not.toBeVisible();
  });
});
