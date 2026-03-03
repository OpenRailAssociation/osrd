import type { Project, Study } from 'common/api/osrdEditoastApi';

import {
  STUDY_DATA,
  STUDY_TRANSLATIONS,
  STUDY_URLS,
  UPDATED_STUDY_DATA,
} from '../../assets/operation-studies/study-const';
import test from '../../page-object-fixture';
import { generateUniqueName } from '../../utils';
import { getProject } from '../../utils/api-utils';
import { DATE_OFFSET, formatDateToDayMonthYear, getISODate } from '../../utils/date-utils';
import { createStudy } from '../../utils/setup-utils';
import { deleteStudy } from '../../utils/teardown-utils';

test.describe('@op @study @management', () => {
  let project: Project;
  let study: Study;

  const createdStudies: { projectId: number; name: string }[] = [];

  test.beforeAll(' Retrieve a project and the translation', async () => {
    project = await getProject();
  });

  test.afterAll(async () => {
    if (!createdStudies.length) return;
    await Promise.allSettled(createdStudies.map((s) => deleteStudy(s.projectId, s.name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new study', async ({ studyPage, page }) => {
    const studyName = generateUniqueName(STUDY_DATA.name);
    const todayISO = getISODate(DATE_OFFSET.TODAY);
    const expectedDate = formatDateToDayMonthYear(todayISO);

    const studyDetails = {
      ...STUDY_DATA,
      name: studyName,
      type: STUDY_TRANSLATIONS.type.flowRate,
      status: STUDY_TRANSLATIONS.status.started,
      startDate: todayISO,
      expectedEndDate: todayISO,
      endDate: todayISO,
    };

    createdStudies.push({ projectId: project.id, name: studyName });

    await test.step('Navigate to project page', async () => {
      await page.goto(STUDY_URLS.project(project.id));
    });

    await test.step('Create a new study', async () => await studyPage.createStudy(studyDetails));

    await test.step('Validate created study data', async () =>
      await studyPage.validateStudyData({
        ...studyDetails,
        startDate: expectedDate,
        expectedEndDate: expectedDate,
        endDate: expectedDate,
      }));
  });

  /** *************** Test 2 **************** */
  test('Update an existing study', async ({ page, studyPage }) => {
    const baseName = generateUniqueName(STUDY_DATA.name);
    const updatedName = `${baseName} (updated)`;
    const tomorrowISO = getISODate(DATE_OFFSET.TOMORROW);
    const expectedDate = formatDateToDayMonthYear(tomorrowISO);

    createdStudies.push({ projectId: project.id, name: updatedName });

    await test.step('Create a base study via API', async () => {
      study = await createStudy(project.id, baseName);
      await page.goto(STUDY_URLS.study(project.id, study.id));
    });

    const updatedDetails = {
      ...UPDATED_STUDY_DATA,
      name: updatedName,
      description: `${study.description} (updated)`,
      startDate: tomorrowISO,
      expectedEndDate: tomorrowISO,
      endDate: tomorrowISO,
    };

    await test.step('Update the study ', async () => {
      await studyPage.updateStudy(updatedDetails);
    });

    await test.step('Validate updated study data', async () => {
      await studyPage.validateStudyData({
        ...updatedDetails,
        startDate: expectedDate,
        expectedEndDate: expectedDate,
        endDate: expectedDate,
        isUpdate: true,
      });
    });

    await test.step('Verify updated study in project list', async () => {
      await page.goto(STUDY_URLS.project(project.id));
      await studyPage.verifyStudyVisibility(updatedName);
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a study', async ({ page, studyPage }) => {
    await test.step('Create a study to delete', async () => {
      study = await createStudy(project.id, generateUniqueName(STUDY_DATA.name));
      createdStudies.push({ projectId: project.id, name: study.name });
    });

    await test.step('Navigate to project studies list', async () => {
      await page.goto(STUDY_URLS.project(project.id));
    });

    await test.step('Delete study by name via UI', async () => {
      await studyPage.deleteStudy(study.name);
    });
  });
});
