import { expect, Page, request } from '../baseFixtures';
import { PlaywrightHomePage } from '../pages/home-page-model';
import PlaywrightRollingstockModalPage from '../pages/rollingstock-modal-model';
import PlaywrightMap, { selectPointOnMapProps } from '../pages/map-model';
import VARIABLES, { BASE_URL } from './operationStudies/testVariables';
import PlaywrightScenarioPage from '../pages/scenario-page-model';
import { ProjectPage } from '../pages/project-page-model';
import { StudyPage } from '../pages/study-page-model';

export default async function createCompleteScenario(
  page: Page,
  scenarioName: string,
  trainScheduleName: string,
  trainCount: string,
  delta: string,
  originSearch: selectPointOnMapProps,
  destinationSearch: selectPointOnMapProps,
  pathfindingDistance: string | RegExp
) {
  const playwrightHomePage = new PlaywrightHomePage(page);
  const scenarioPage = new PlaywrightScenarioPage(page);
  const projectPage = new ProjectPage(page);
  const studyPage = new StudyPage(page);
  const playwrightMap = new PlaywrightMap(playwrightHomePage.page);

  await playwrightHomePage.goToHomePage();

  // Real click on project, study, scenario
  await playwrightHomePage.goToOperationalStudiesPage();
  await projectPage.openProjectByTestId('_@Test integration project');
  await studyPage.openStudyByTestId('_@Test integration study');

  await scenarioPage.openScenarioCreationModal();
  await scenarioPage.setScenarioName(scenarioName);
  await scenarioPage.setScenarioInfraByName(VARIABLES.infraName);
  const createButton = playwrightHomePage.page.getByText('Créer le scénario');
  await createButton.click();
  await playwrightMap.page.waitForTimeout(2000);

  await scenarioPage.checkInfraLoaded();
  await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

  await scenarioPage.setTrainScheduleName(trainScheduleName);
  await scenarioPage.setNumberOfTrains(trainCount);
  await scenarioPage.setDelta(delta);

  // ***************** Select Rolling Stock *****************
  const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
    playwrightHomePage.page
  );
  await playwrightRollingstockModalPage.openRollingstockModal();

  const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
    VARIABLES.rollingstockTestID
  );
  await rollingstockCard.click();
  await rollingstockCard.locator('button').click();

  // ***************** Select Origin/Destination *****************
  await scenarioPage.openTabByText('Itinéraire');
  await playwrightMap.page.waitForTimeout(2000);
  const itinerary = scenarioPage.getItineraryModule;
  await expect(itinerary).toBeVisible();
  await expect(scenarioPage.getMapModule).toBeVisible();

  // Search and select origin
  await playwrightMap.selectOrigin(originSearch);

  // Search and select destination
  await playwrightMap.selectDestination(destinationSearch);

  await scenarioPage.checkPathfindingDistance(pathfindingDistance);

  // ***************** Create train *****************
  await scenarioPage.addTrainSchedule();
  await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
  await scenarioPage.checkToastSNCFTitle('Train ajouté');
  await scenarioPage.returnSimulationResult();
}

// API requests

const getApiContext = async () =>
  request.newContext({
    baseURL: BASE_URL || 'http://localhost:8090',
  });

export const getApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const response = await apiContext.get(url);
  return response.json();
};

export const postApiRequest = async <T>(url: string, data: T) => {
  const apiContext = await getApiContext();
  const newProject = await apiContext.post(url, { data });
  return newProject.json();
};

export const deleteApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const deleteProject = apiContext.delete(url);
  return deleteProject;
};
