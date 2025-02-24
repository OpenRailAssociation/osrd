import { v4 as uuidv4 } from 'uuid';

import type { Project, Study } from 'common/api/osrdEditoastApi';

import test from './logging-fixture';
import StudyPage from './pages/operational-studies/study-page';
import { generateUniqueName, getTranslations } from './utils';
import { getProject } from './utils/api-utils';
import { formatDateToDayMonthYear } from './utils/date-utils';
import readJsonFile from './utils/file-utils';
import { createStudy } from './utils/setup-utils';
import { deleteStudy } from './utils/teardown-utils';
import type { FlatTranslations, StudyData } from './utils/types';

type StudyTranslations = {
  studyCategories: FlatTranslations;
  studyStates: FlatTranslations;
};

const studyData: StudyData = readJsonFile('tests/assets/operation-studies/study.json');
const enTranslations: StudyTranslations = readJsonFile(
  'public/locales/en/operationalStudies/study.json'
);
const frTranslations: StudyTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/study.json'
);

test.describe('Validate the Study creation workflow', () => {
  let studyPage: StudyPage;

  let project: Project;
  let study: Study;
  let translations: typeof enTranslations | typeof frTranslations;

  test.beforeAll(' Retrieve a project and the translation', async () => {
    project = await getProject();
    translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
  });

  test.beforeEach(async ({ page }) => {
    studyPage = new StudyPage(page);
  });

  /** *************** Test 1 **************** */
  test('Create a new study', async ({ page }) => {
    // Navigate to project page
    await page.goto(`/operational-studies/projects/${project.id}`);
    const studyName = `${studyData.name} ${uuidv4()}`; // Unique study name
    const todayDateISO = new Date().toISOString().split('T')[0]; // Get today's date in ISO format
    const expectedDate = formatDateToDayMonthYear(todayDateISO);
    // Create a new study using the study page model
    await studyPage.createStudy({
      name: studyName,
      description: studyData.description,
      type: translations.studyCategories.flowRate, // Translated study type
      status: translations.studyStates.started, // Translated study status
      startDate: todayDateISO,
      expectedEndDate: todayDateISO,
      endDate: todayDateISO,
      serviceCode: studyData.service_code,
      businessCode: studyData.business_code,
      budget: studyData.budget,
      tags: studyData.tags,
    });

    // Validate that the study was created with the correct data
    await studyPage.validateStudyData({
      name: studyName,
      description: studyData.description,
      type: translations.studyCategories.flowRate,
      status: translations.studyStates.started,
      startDate: expectedDate,
      expectedEndDate: expectedDate,
      endDate: expectedDate,
      serviceCode: studyData.service_code,
      businessCode: studyData.business_code,
      budget: studyData.budget,
      tags: studyData.tags,
    });
    await deleteStudy(project.id, studyName);
  });

  /** *************** Test 2 **************** */
  test('Update an existing study', async ({ page }) => {
    // Create a study
    study = await createStudy(project.id, generateUniqueName(studyData.name));
    // Navigate to study page
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    const tomorrowDateISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Get tomorrow's date in ISO format
    const expectedDate = formatDateToDayMonthYear(tomorrowDateISO);
    // Update the study with new values
    await studyPage.updateStudy({
      name: `${study.name} (updated)`,
      description: `${study.description} (updated)`,
      type: translations.studyCategories.operability,
      status: translations.studyStates.inProgress,
      startDate: tomorrowDateISO,
      expectedEndDate: tomorrowDateISO,
      endDate: tomorrowDateISO,
      serviceCode: 'A1230',
      businessCode: 'B1230',
      budget: '123456789',
      tags: ['update-tag'],
    });

    // Navigate back to the project page
    await page.goto(`/operational-studies/projects/${project.id}`);

    // Reopen the updated study and validate the updated data
    await studyPage.openStudyByTestId(`${study.name} (updated)`);
    await studyPage.validateStudyData({
      name: `${study.name} (updated)`,
      description: `${study.description} (updated)`,
      type: translations.studyCategories.operability,
      status: translations.studyStates.inProgress,
      startDate: expectedDate,
      expectedEndDate: expectedDate,
      endDate: expectedDate,
      serviceCode: 'A1230',
      businessCode: 'B1230',
      budget: '123456789',
      tags: ['update-tag'],
      isUpdate: true, // Indicate that this is an update
    });
    await deleteStudy(project.id, `${study.name} (updated)`);
  });

  /** *************** Test 3 **************** */
  test('Delete a study', async ({ page }) => {
    // Create a study
    study = await createStudy(project.id, generateUniqueName(studyData.name));

    // Navigate to the list of studies for the project
    await page.goto(`/operational-studies/projects/${project.id}`);

    // Delete the study by name using the study page model
    await studyPage.deleteStudy(study.name);
  });
});
