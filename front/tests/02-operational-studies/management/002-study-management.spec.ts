import { expect } from '@playwright/test';

import type { Project, Study } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { generateUniqueName } from '../../utils';
import { getProject } from '../../utils/api-utils';
import { formatDateToDayMonthYear } from '../../utils/date-utils';
import { readJsonFile } from '../../utils/file-utils';
import { createStudy } from '../../utils/setup-utils';
import { deleteStudy } from '../../utils/teardown-utils';
import type { StudyData, StudyFrTranslations } from '../../utils/types';

const studyData: StudyData = readJsonFile('tests/assets/operation-studies/study.json');

const frTranslations: StudyFrTranslations = readJsonFile(
  'public/locales/fr/operational-studies.json'
);

test.describe('@op @study @management', () => {
  let project: Project;
  let study: Study;

  const createdStudies: { projectId: number; name: string }[] = [];

  test.beforeAll(' Retrieve a project and the translation', async () => {
    project = await getProject();
  });

  test.afterAll(async () => {
    if (!createdStudies.length) return;
    const studiesToDelete = [...createdStudies];
    await Promise.allSettled(studiesToDelete.map((s) => deleteStudy(s.projectId, s.name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new study', async ({ page, studyPage }) => {
    await test.step('Navigate to project page', async () => {
      await page.goto(`/operational-studies/projects/${project.id}`);
    });

    const studyName = generateUniqueName(studyData.name);
    const todayDateISO = new Date().toISOString().split('T')[0];
    const expectedDate = formatDateToDayMonthYear(todayDateISO);

    createdStudies.push({ projectId: project.id, name: studyName });

    await test.step('Create a new study', async () => {
      await studyPage.createStudy({
        name: studyName,
        description: studyData.description,
        type: frTranslations.study.studyCategories.flowRate,
        status: frTranslations.study.studyStates.started,
        startDate: todayDateISO,
        expectedEndDate: todayDateISO,
        endDate: todayDateISO,
        serviceCode: studyData.service_code,
        businessCode: studyData.business_code,
        budget: studyData.budget,
        tags: studyData.tags,
      });
    });

    await test.step('Validate created study data', async () => {
      await studyPage.validateStudyData({
        name: studyName,
        description: studyData.description,
        type: frTranslations.study.studyCategories.flowRate,
        status: frTranslations.study.studyStates.started,
        startDate: expectedDate,
        expectedEndDate: expectedDate,
        endDate: expectedDate,
        serviceCode: studyData.service_code,
        businessCode: studyData.business_code,
        budget: studyData.budget,
        tags: studyData.tags,
      });
    });
  });

  /** *************** Test 2 **************** */
  test('Update an existing study', async ({ page, studyPage }) => {
    const baseName = generateUniqueName(studyData.name);
    const updatedName = `${baseName} (updated)`;
    createdStudies.push({ projectId: project.id, name: updatedName });

    await test.step('Navigate to created study', async () => {
      study = await createStudy(project.id, baseName);
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    });

    const tomorrowDateISO = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const expectedDate = formatDateToDayMonthYear(tomorrowDateISO);

    await test.step('Update the study', async () => {
      await studyPage.updateStudy({
        name: updatedName,
        description: `${study.description} (updated)`,
        type: frTranslations.study.studyCategories.operability,
        status: frTranslations.study.studyStates.inProgress,
        startDate: tomorrowDateISO,
        expectedEndDate: tomorrowDateISO,
        endDate: tomorrowDateISO,
        serviceCode: 'A1230',
        businessCode: 'B1230',
        budget: '123456789',
        tags: ['update-tag'],
      });
    });

    await test.step('Validate updated study data', async () => {
      await studyPage.validateStudyData({
        name: updatedName,
        description: `${study.description} (updated)`,
        type: frTranslations.study.studyCategories.operability,
        status: frTranslations.study.studyStates.inProgress,
        startDate: expectedDate,
        expectedEndDate: expectedDate,
        endDate: expectedDate,
        serviceCode: 'A1230',
        businessCode: 'B1230',
        budget: '123456789',
        tags: ['update-tag'],
        isUpdate: true,
      });
    });

    await test.step('Verify updated study in project list (tags)', async () => {
      await page.goto(`/operational-studies/projects/${project.id}`);
      await expect(page.getByTestId(updatedName).first()).toBeVisible();
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a study', async ({ page, studyPage }) => {
    await test.step('Create a study to delete', async () => {
      study = await createStudy(project.id, generateUniqueName(studyData.name));
      createdStudies.push({ projectId: project.id, name: study.name });
    });

    await test.step('Navigate to project studies list', async () => {
      await page.goto(`/operational-studies/projects/${project.id}`);
    });

    await test.step('Delete study by name via UI', async () => {
      await studyPage.deleteStudy(study.name);
    });
  });
});
