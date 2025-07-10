import test from '@playwright/test';

import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import OperationalStudiesImportSection from './pages/operational-studies/operational-studies-import-section';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import createScenario from './utils/scenario';

test.describe('Verify trains import from XML file', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  //let scenarioTimetableSection: ScenarioTimetableSection;
  let operationalStudiesPage: OperationalStudiesPage;
  let operationalStudiesImportSection: OperationalStudiesImportSection;
  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll(
    'Setup project, study, infra and create scenario with timetableItems',
    async () => {
      project = await getProject(trainScheduleProjectName);
      study = await getStudy(project.id, trainScheduleStudyName);
      infra = await getInfra();
      scenarioItems = (
        await createScenario(
          generateUniqueName('timetable-item-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
    }
  );

  test.beforeEach('Go to scenario page', async ({ page }) => {
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
    await page.waitForLoadState('networkidle');
  });

  test('Import trains from file of format 1', async ({ page }) => {
    operationalStudiesPage = new OperationalStudiesPage(page);
    operationalStudiesImportSection = new OperationalStudiesImportSection(page);

    await operationalStudiesPage.openTimetableImportModal();
    await operationalStudiesImportSection.openTimetableImportModal();
  });
});
