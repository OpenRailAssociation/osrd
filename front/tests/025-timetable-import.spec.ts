import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
import test from './logging-fixture';
import ImportPage from './pages/import-page';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import type { CommonTranslations, TimetableFilterTranslations } from './utils/types';

const frTimetableTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frTimetableTranslations,
  ...frCommonTranslations,
};

test.describe('Verify timetable items import', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let importPage: ImportPage;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario ', async ({ page }) => {
    importPage = new ImportPage(page);

    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenario = (
        await createScenario(generateUniqueName('import-scenario'), project.id, study.id, infra.id)
      ).scenario;
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  test('Verify timetable items are imported correctly', async () => {
    await test.step('Verify timetable is empty', async () => {
      await importPage.verifyTimetableIsEmpty(frTranslations.timetable.noTrain);
    });
    await test.step('Import timetable items JSON and return to scenario', async () => {
      await importPage.openImportTimetableItemForm();
      await importPage.openUploadDialog();
      await importPage.uploadTimetableItemFile(
        './tests/assets/operation-studies/timetable-items.json',
        {
          totalPacedTrainCount: 4,
          totalTrainScheduleCount: 12,
        }
      );
      await importPage.launchTimetableItemImport(frTranslations.success);
      await importPage.returnSimulationResult();
    });

    await test.step('Verify timetable items count after import', async () => {
      await importPage.returnSimulationResult();
      await importPage.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 4,
        totalTrainScheduleCount: 12,
      });
    });
  });
});
