import type { RootState } from 'reducers';
import buildInfraStateSelectors from 'reducers/infra/selectors';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdConfState } from 'reducers/osrdconf/types';
import { makeSubSelector } from 'utils/selectors';

const buildCommonConfSelectors = <ConfState extends OsrdConfState>(
  slice: OperationalStudiesConfSlice | StdcmConfSlice
) => {
  const getConf = (state: RootState) => state[slice.name] as ConfState;
  const makeOsrdConfSelector = makeSubSelector<ConfState>(getConf);

  const getPathSteps = makeOsrdConfSelector('pathSteps');

  return {
    ...buildInfraStateSelectors(slice),
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
    getGeojson: makeOsrdConfSelector('geojson'),
    getGridMarginBefore: makeOsrdConfSelector('gridMarginBefore'),
    getGridMarginAfter: makeOsrdConfSelector('gridMarginAfter'),
    getPowerRestrictionRanges: makeOsrdConfSelector('powerRestrictionRanges'),
    getTrainScheduleIDsToModify: makeOsrdConfSelector('trainScheduleIDsToModify'),
    getFeatureInfoClick: makeOsrdConfSelector('featureInfoClick'),
    getPathSteps,
    getOriginV2: (state: RootState) => {
      const pathSteps = getPathSteps(state);
      return pathSteps[0];
    },
    getDestinationV2: (state: RootState) => {
      const pathSteps = getPathSteps(state);
      return pathSteps[pathSteps.length - 1];
    },
    getViasV2: (state: RootState) => {
      const pathSteps = getPathSteps(state);
      pathSteps.shift();
      pathSteps.pop();
      return pathSteps;
    },
  };
};

export default buildCommonConfSelectors;
