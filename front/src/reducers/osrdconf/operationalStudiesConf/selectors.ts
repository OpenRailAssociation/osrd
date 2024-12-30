import { compact } from 'lodash';
import { createSelector } from 'reselect';

import type { RootState } from 'reducers';
import {
  operationalStudiesConfSlice,
  type OperationalStudiesConfState,
} from 'reducers/osrdconf/operationalStudiesConf';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { makeSubSelector } from 'utils/selectors';

const buildOperationalStudiesConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors(operationalStudiesConfSlice);

  const getOperationalStudiesConf = (state: RootState) => state[operationalStudiesConfSlice.name];
  const makeOsrdConfSelector =
    makeSubSelector<OperationalStudiesConfState>(getOperationalStudiesConf);

  const getPathSteps = makeOsrdConfSelector('pathSteps');

  // If createSelector is not used and we return directly : pathSteps.slice(1, -1), we get this rtk warning :
  // Selector getVias returned a different result when called with the same parameters. This can lead to unnecessary rerenders.
  // Selectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization
  const viasSelector = createSelector(
    getPathSteps,
    (pathSteps) => compact(pathSteps.slice(1, -1)) // a via can't be null
  );

  return {
    ...commonConfSelectors,
    getOperationalStudiesConf,

    getName: makeOsrdConfSelector('name'),
    getStartTime: makeOsrdConfSelector('startTime'),
    getInitialSpeed: makeOsrdConfSelector('initialSpeed'),
    getLabels: makeOsrdConfSelector('labels'),

    getRollingStockComfort: makeOsrdConfSelector('rollingStockComfort'),

    getPathSteps,
    getOrigin: (state: RootState) => {
      const pathSteps = getPathSteps(state);
      return pathSteps[0];
    },
    getDestination: (state: RootState) => {
      const pathSteps = getPathSteps(state);
      return pathSteps[pathSteps.length - 1];
    },
    /** To use this action, do useSelector(getVias()) */
    getVias: () => viasSelector,

    getConstraintDistribution: makeOsrdConfSelector('constraintDistribution'),
    getUsingElectricalProfiles: makeOsrdConfSelector('usingElectricalProfiles'),
    getPowerRestrictions: makeOsrdConfSelector('powerRestriction'),

    getTrainCount: makeOsrdConfSelector('trainCount'),
    getTrainDelta: makeOsrdConfSelector('trainDelta'),
    getTrainStep: makeOsrdConfSelector('trainStep'),
  };
};

const selectors = buildOperationalStudiesConfSelectors();

export const {
  getOperationalStudiesConf,
  getName,
  getStartTime,
  getInitialSpeed,
  getLabels,
  getRollingStockComfort,
  getPathSteps,
  getOrigin,
  getDestination,
  getVias,
  getConstraintDistribution,
  getUsingElectricalProfiles,
  getPowerRestrictions,
  getTrainCount,
  getTrainDelta,
  getTrainStep,
} = selectors;

export type OperationalStudiesConfSelectors = typeof selectors;

export default selectors;
