import { OsrdConfState } from 'applications/operationalStudies/consts';
import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { simulationConfSliceType } from '../simulationConf';
import { stdcmConfSliceType } from '../stdcmConf';

const buildCommonConfSelectors = (slice: simulationConfSliceType | stdcmConfSliceType) => {
  const getConf = (state: RootState) => state[slice.name];
  const makeOsrdConfSelector = makeSubSelector<OsrdConfState>(getConf);
  return {
    getConf,
    getName: makeOsrdConfSelector('name'),
    getTrainCount: makeOsrdConfSelector('trainCount'),
    getTrainDelta: makeOsrdConfSelector('trainDelta'),
    getTrainStep: makeOsrdConfSelector('trainStep'),
    getAllowances: makeOsrdConfSelector('allowances'),
    getUsingElectricalProfiles: makeOsrdConfSelector('usingElectricalProfiles'),
    getLabels: makeOsrdConfSelector('labels'),
    getProjectID: makeOsrdConfSelector('projectID'),
    getStudyID: makeOsrdConfSelector('studyID'),
    getScenarioID: makeOsrdConfSelector('scenarioID'),
    getInfraID: makeOsrdConfSelector('infraID'),
    getSwitchTypes: makeOsrdConfSelector('switchTypes'),
    getPathfindingID: makeOsrdConfSelector('pathfindingID'),
    getTimetableID: makeOsrdConfSelector('timetableID'),
    getRollingStockID: makeOsrdConfSelector('rollingStockID'),
    getRollingStockComfort: makeOsrdConfSelector('rollingStockComfort'),
    getSpeedLimitByTag: makeOsrdConfSelector('speedLimitByTag'),
    getOrigin: makeOsrdConfSelector('origin'),
    getDepartureTime: makeOsrdConfSelector('departureTime'),
    getInitialSpeed: makeOsrdConfSelector('initialSpeed'),
    getOriginDate: makeOsrdConfSelector('originDate'),
    getOriginTime: makeOsrdConfSelector('originTime'),
    getOriginUpperBoundDate: makeOsrdConfSelector('originUpperBoundDate'),
    getOriginUpperBoundTime: makeOsrdConfSelector('originUpperBoundTime'),
    getOriginLinkedBounds: makeOsrdConfSelector('originLinkedBounds'),
    getDestination: makeOsrdConfSelector('destination'),
    getDestinationDate: makeOsrdConfSelector('destinationDate'),
    getDestinationTime: makeOsrdConfSelector('destinationTime'),
    getVias: makeOsrdConfSelector('vias'),
    getSuggeredVias: makeOsrdConfSelector('suggeredVias'),
    getTrainCompo: makeOsrdConfSelector('trainCompo'),
    getGeojson: makeOsrdConfSelector('geojson'),
    getFeatureInfoClick: makeOsrdConfSelector('featureInfoClick'),
    getGridMarginBefore: makeOsrdConfSelector('gridMarginBefore'),
    getGridMarginAfter: makeOsrdConfSelector('gridMarginAfter'),
    getPowerRestrictionRanges: makeOsrdConfSelector('powerRestrictionRanges'),
    getTrainScheduleIDsToModify: makeOsrdConfSelector('trainScheduleIDsToModify'),
  };
};

export default buildCommonConfSelectors;
