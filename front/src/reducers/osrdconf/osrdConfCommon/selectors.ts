import { compact } from 'lodash';
import { createSelector } from 'reselect';

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

  // If createSelector is not used and we return directly : pathSteps.slice(1, -1), we get this rtk warning :
  // Selector getViasV2 returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
  // Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization
  const viasSelector = createSelector(
    getPathSteps,
    (pathSteps) => compact(pathSteps.slice(1, -1)) // a via can't be null
  );

  return {
    ...buildInfraStateSelectors(slice),
    getConf,
    getConstraintDistribution: makeOsrdConfSelector('constraintDistribution'),
    getName: makeOsrdConfSelector('name'),
    getTrainCount: makeOsrdConfSelector('trainCount'),
    getTrainDelta: makeOsrdConfSelector('trainDelta'),
    getTrainStep: makeOsrdConfSelector('trainStep'),
    getUsingElectricalProfiles: makeOsrdConfSelector('usingElectricalProfiles'),
    getLabels: makeOsrdConfSelector('labels'),
    getProjectID: makeOsrdConfSelector('projectID'),
    getStudyID: makeOsrdConfSelector('studyID'),
    getScenarioID: makeOsrdConfSelector('scenarioID'),
    getTimetableID: makeOsrdConfSelector('timetableID'),
    getElectricalProfileSetId: makeOsrdConfSelector('electricalProfileSetId'),
    getRollingStockID: makeOsrdConfSelector('rollingStockID'),
    getSpeedLimitByTag: makeOsrdConfSelector('speedLimitByTag'),
    getInitialSpeed: makeOsrdConfSelector('initialSpeed'),
    getOriginDate: makeOsrdConfSelector('originDate'),
    getOriginTime: makeOsrdConfSelector('originTime'),
    getOriginUpperBoundDate: makeOsrdConfSelector('originUpperBoundDate'),
    getOriginUpperBoundTime: makeOsrdConfSelector('originUpperBoundTime'),
    getOriginLinkedBounds: makeOsrdConfSelector('originLinkedBounds'),
    getGridMarginBefore: makeOsrdConfSelector('gridMarginBefore'),
    getGridMarginAfter: makeOsrdConfSelector('gridMarginAfter'),
    getPowerRestrictionV2: makeOsrdConfSelector('powerRestrictionV2'),
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
    /** To use this action, do useSelector(getViasV2()) */
    getViasV2: () => viasSelector,
    getRollingStockComfortV2: makeOsrdConfSelector('rollingStockComfortV2'),
    getStartTime: makeOsrdConfSelector('startTime'),
  };
};

export default buildCommonConfSelectors;
