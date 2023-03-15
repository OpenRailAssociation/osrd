import {
  OsrdMultiConfState,
  OsrdConfState,
  OsrdStdcmConfState,
  MODES,
} from 'applications/operationalStudies/consts';
import { RootState } from 'reducers';

function getSection(state: RootState): OsrdConfState | OsrdStdcmConfState {
  type confSections = Omit<OsrdMultiConfState, 'mode'>;
  type SectionKey = keyof confSections;

  const sectionMap: Record<string, SectionKey> = {
    [MODES.simulation]: 'simulationConf',
    [MODES.stdcm]: 'stdcmConf',
  };

  const section: SectionKey = sectionMap[state.osrdconf.mode];
  return state.osrdconf[section];
}

export const getConf = (state: RootState) => getSection(state);
export const getName = (state: RootState) => getSection(state).name;
export const getMode = (state: RootState) => state.osrdconf.mode;
export const getStdcmMode = (state: RootState) => state.osrdconf.stdcmConf.stdcmMode;
export const getLabels = (state: RootState) => getSection(state).labels;
export const getProjectID = (state: RootState) => getSection(state).projectID;
export const getStudyID = (state: RootState) => getSection(state).studyID;
export const getScenarioID = (state: RootState) => getSection(state).scenarioID;
export const getInfraID = (state: RootState) => getSection(state).infraID;
export const getSwitchTypes = (state: RootState) => getSection(state).switchTypes;
export const getPathfindingID = (state: RootState) => getSection(state).pathfindingID;
export const getTimetableID = (state: RootState) => getSection(state).timetableID;
export const getRollingStockID = (state: RootState) => getSection(state).rollingStockID;
export const getRollingStockComfort = (state: RootState) => getSection(state).rollingStockComfort;
export const getSpeedLimitByTag = (state: RootState) => getSection(state).speedLimitByTag;
export const getOrigin = (state: RootState) => getSection(state).origin;
export const getOriginSpeed = (state: RootState) => getSection(state).originSpeed;
export const getOriginDate = (state: RootState) => getSection(state).originDate;
export const getOriginTime = (state: RootState) => getSection(state).originTime;
export const getOriginUpperBoundDate = (state: RootState) => getSection(state).originUpperBoundDate;
export const getOriginUpperBoundTime = (state: RootState) => getSection(state).originUpperBoundTime;
export const getOriginLinkedBounds = (state: RootState) => getSection(state).originLinkedBounds;
export const getDestination = (state: RootState) => getSection(state).destination;
export const getDestinationDate = (state: RootState) => getSection(state).destinationDate;
export const getDestinationTime = (state: RootState) => getSection(state).destinationTime;
export const getVias = (state: RootState) => getSection(state).vias;
export const getSuggeredVias = (state: RootState) => getSection(state).suggeredVias;
export const getTrainCompo = (state: RootState) => getSection(state).trainCompo;
export const getGeojson = (state: RootState) => getSection(state).geojson;
export const getFeatureInfoClick = (state: RootState) => getSection(state).featureInfoClick;
export const getGridMarginBefore = (state: RootState) => getSection(state).gridMarginBefore;
export const getGridMarginAfter = (state: RootState) => getSection(state).gridMarginAfter;
export const getStandardStdcmAllowance = (state: RootState) =>
  state.osrdconf.stdcmConf.standardStdcmAllowance;
