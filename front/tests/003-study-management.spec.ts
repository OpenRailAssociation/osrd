import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type { Project, Study } from 'common/api/osrdEditoastApi';

import studyData from './assets/operationStudies/study.json';
import CommonPage from './pages/common-page-model';
import HomePage from './pages/home-page-model';
import StudyPage from './pages/study-page-model';
import { getProject, postApiRequest } from './utils/api-setup';

test.use({
  launchOptions: {
    slowMo: 10, // Introduces a slight delay to prevent UI elements (e.g., "Create Study" button and "Study edition" modal) from overlapping due to fast test execution.
  },
});

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
    const studyPage = new StudyPage(page);
    const commonPage = new CommonPage(page);

    await page.goto(`/operational-studies/projects/${project.id}`);

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

    await studyPage.createStudyButton.click();

    await expect(studyPage.studyEditionModal).not.toBeVisible();

    await expect(studyPage.getStudyName).toHaveText(studyName);
    await expect(studyPage.getStudyDescription).toHaveText(studyData.description);
    await expect(studyPage.getStudyType).toHaveText(studyData.type);
    await expect(studyPage.getStudyState.first()).toHaveText(studyData.state);

    await expect(studyPage.studyServiceCodeInfo).toHaveText(studyData.service_code);
    await expect(studyPage.studyBusinessCodeInfo).toHaveText(studyData.business_code);
    expect(await studyPage.getNumericFinancialsAmount()).toBe('1 234 567 890 €');
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain(studyData.tags.join(''));
  });

  test('Update a study', async ({ page }) => {
    const studyPage = new StudyPage(page);
    const commonPage = new CommonPage(page);

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

    await expect(studyPage.getStudyName).toHaveText(`${study.name} (updated)`);
    await expect(studyPage.getStudyDescription).toHaveText(`${study.description} (updated)`);
    await expect(studyPage.getStudyType).toHaveText('Exploitabilité');
    await expect(studyPage.getStudyState.nth(1)).toHaveText('En cours');
    await expect(studyPage.studyServiceCodeInfo).toHaveText(`${study.service_code} (updated)`);
    await expect(studyPage.studyBusinessCodeInfo).toHaveText(`${study.business_code} (updated)`);
    expect(await studyPage.getNumericFinancialsAmount()).toBe('123 456 789 €');
    const tags = await studyPage.getStudyTags.textContent();
    expect(tags).toContain('update-tag');
  });

  test('Delete a study', async ({ page }) => {
    const homePage = new HomePage(page);
    const studyPage = new StudyPage(page);

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    await studyPage.openStudyModalUpdate();

    await studyPage.clickStudyDeleteConfirmBtn();

    await homePage.goToHomePage();
    await homePage.goToOperationalStudiesPage();

    await expect(studyPage.getStudyByName(studyData.name)).not.toBeVisible();
  });
});
