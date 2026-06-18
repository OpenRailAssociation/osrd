import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import { PLACEHOLDER } from './itinerary-modal.consts';

test.describe('Itinerary Modal, Default ', { tag: ['@op', '@itinerary-modal'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page, operationalStudiesPage }) => {
      ({ project, study, scenario } = await createScenario());

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      await waitForInfraStateToBeCached(infra.id);
      await operationalStudiesPage.openItineraryModal();
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test(
    'Display the itinerary modal default structure',
    { tag: '@smoke' },
    async ({ itineraryModalPage }) => {
      await test.step('Empty default state of the itinerary modal', async () => {
        await itineraryModalPage.checkItineraryModalDefaultState();
      });
      await test.step('Check the header content of the itinerary modal', async () => {
        await itineraryModalPage.checkItineraryModalHeader(PLACEHOLDER);
      });
      await test.step('Default rocket search', async () => {
        await itineraryModalPage.checkItineraryModalEmptyRocket();
      });
      await test.step('Default itinerary row content', async () => {
        await itineraryModalPage.checkItineraryModalDefaultRowContent();
      });
      //TODO test on "Default control visibility"
    }
  );
});
