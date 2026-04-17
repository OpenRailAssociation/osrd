import type { Page } from '@playwright/test';

import testWithLogging from './logging-fixture';
import HomePage from './pages/home-page';
import GetManchetteComponent from './pages/operational-studies/get-manchette-component';
import ImportExportPage from './pages/operational-studies/import-export-page';
import NGEPage from './pages/operational-studies/nge-page';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ProjectPage from './pages/operational-studies/project-page';
import RoundTripPage from './pages/operational-studies/round-trips-page';
import RouteTab from './pages/operational-studies/route-tab';
import ScenarioPage from './pages/operational-studies/scenario-page';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import OpSimulationResultPage from './pages/operational-studies/simulation-results-page';
import SimulationSettingsTab from './pages/operational-studies/simulation-settings-tab';
import StudyPage from './pages/operational-studies/study-page';
import TimeAndStopSimulationOutputs from './pages/operational-studies/time-stop-simulation-outputs';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import TrainScheduleDetailSection from './pages/operational-studies/train-schedules-details-section';
import RollingstockEditorPage from './pages/rolling-stock/rolling-stock-editor-page';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import ConsistChangeSection from './pages/stdcm/consist-change-section';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import LinkedTrainSection from './pages/stdcm/linked-train-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import ViaSection from './pages/stdcm/via-section';

type Fixtures = {
  // Operational studies
  operationalStudiesPage: OperationalStudiesPage;
  projectPage: ProjectPage;
  studyPage: StudyPage;
  scenarioPage: ScenarioPage;
  routeTab: RouteTab;
  pacedTrainSection: PacedTrainSection;
  timesAndStopsTab: TimesAndStopsTab;
  timeAndStopSimulationOutputs: TimeAndStopSimulationOutputs;
  simulationSettingsTab: SimulationSettingsTab;
  opSimulationResultPage: OpSimulationResultPage;
  scenarioTimetableSection: ScenarioTimetableSection;
  trainScheduleDetailSection: TrainScheduleDetailSection;
  getManchetteComponent: GetManchetteComponent;
  ngePage: NGEPage;
  roundTripPage: RoundTripPage;
  importExportPage: ImportExportPage;

  // Rolling stock
  rollingStockSelector: RollingStockSelector;
  rollingStockEditorPage: RollingstockEditorPage;

  // STDCM
  stdcmPage: STDCMPage;
  consistSection: ConsistSection;
  originSection: OriginSection;
  viaSection: ViaSection;
  consistChangeSection: ConsistChangeSection;
  destinationSection: DestinationSection;
  linkedTrainSection: LinkedTrainSection;
  stdcmSimulationResultPage: SimulationResultPage;

  // Generic
  homePage: HomePage;

  // Second page + only the POs needed for multi-tab tests
  secondPage: Page;
  secondOperationalStudiesPage: OperationalStudiesPage;
  secondScenarioTimetableSection: ScenarioTimetableSection;
};

/**
 * Factory used when you obtain a stdcm Page dynamically (new tab via waitForEvent('page')).
 */
export function createStdcmTab(page: Page) {
  return {
    page,
    consistSection: new ConsistSection(page),
    originSection: new OriginSection(page),
    viaSection: new ViaSection(page),
    destinationSection: new DestinationSection(page),
  };
}

const test = testWithLogging.extend<Fixtures>({
  // Operational studies
  operationalStudiesPage: async ({ page }, use) => {
    await use(new OperationalStudiesPage(page));
  },
  projectPage: async ({ page }, use) => {
    await use(new ProjectPage(page));
  },
  studyPage: async ({ page }, use) => {
    await use(new StudyPage(page));
  },
  scenarioPage: async ({ page }, use) => {
    await use(new ScenarioPage(page));
  },
  routeTab: async ({ page }, use) => {
    await use(new RouteTab(page));
  },
  pacedTrainSection: async ({ page }, use) => {
    await use(new PacedTrainSection(page));
  },
  timesAndStopsTab: async ({ page }, use) => {
    await use(new TimesAndStopsTab(page));
  },
  timeAndStopSimulationOutputs: async ({ page }, use) => {
    await use(new TimeAndStopSimulationOutputs(page));
  },
  simulationSettingsTab: async ({ page }, use) => {
    await use(new SimulationSettingsTab(page));
  },
  opSimulationResultPage: async ({ page }, use) => {
    await use(new OpSimulationResultPage(page));
  },
  scenarioTimetableSection: async ({ page }, use) => {
    await use(new ScenarioTimetableSection(page));
  },
  trainScheduleDetailSection: async ({ page }, use) => {
    await use(new TrainScheduleDetailSection(page));
  },
  getManchetteComponent: async ({ page }, use) => {
    await use(new GetManchetteComponent(page));
  },
  ngePage: async ({ page }, use) => {
    await use(new NGEPage(page));
  },
  roundTripPage: async ({ page }, use) => {
    await use(new RoundTripPage(page));
  },

  // Rolling stock
  rollingStockSelector: async ({ page }, use) => {
    await use(new RollingStockSelector(page));
  },
  rollingStockEditorPage: async ({ page }, use) => {
    await use(new RollingstockEditorPage(page));
  },

  // STDCM
  stdcmPage: async ({ page }, use) => {
    await use(new STDCMPage(page));
  },
  consistSection: async ({ page }, use) => {
    await use(new ConsistSection(page));
  },
  originSection: async ({ page }, use) => {
    await use(new OriginSection(page));
  },
  viaSection: async ({ page }, use) => {
    await use(new ViaSection(page));
  },
  consistChangeSection: async ({ page }, use) => {
    await use(new ConsistChangeSection(page));
  },
  destinationSection: async ({ page }, use) => {
    await use(new DestinationSection(page));
  },
  linkedTrainSection: async ({ page }, use) => {
    await use(new LinkedTrainSection(page));
  },
  stdcmSimulationResultPage: async ({ page }, use) => {
    await use(new SimulationResultPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  importExportPage: async ({ page }, use) => {
    await use(new ImportExportPage(page));
  },

  // Second TAB fixtures for multi-tab tests
  secondPage: async ({ context }, use) => {
    const secondPage = await context.newPage();
    await use(secondPage);
    await secondPage.close();
  },
  secondOperationalStudiesPage: async ({ secondPage }, use) => {
    await use(new OperationalStudiesPage(secondPage));
  },
  secondScenarioTimetableSection: async ({ secondPage }, use) => {
    await use(new ScenarioTimetableSection(secondPage));
  },
});

export default test;
