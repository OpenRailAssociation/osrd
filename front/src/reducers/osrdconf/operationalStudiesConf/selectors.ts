import { compact } from 'lodash';
import { createSelector } from 'reselect';

import type { RootState } from 'reducers';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { makeSubSelector } from 'utils/selectors';

import type { OperationalStudiesConfState } from '../types';

const buildOperationalStudiesConfSelectors = () => {
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
    ...buildCommonConfSelectors(operationalStudiesConfSlice),

    getOperationalStudiesConf,

    getName: makeOsrdConfSelector('name'),
    getStartTime: makeOsrdConfSelector('startTime'),
    getInitialSpeed: makeOsrdConfSelector('initialSpeed'),
    getLabels: makeOsrdConfSelector('labels'),
    getCategory: makeOsrdConfSelector('category'),

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

    getEditingItemType: makeOsrdConfSelector('editingItemType'),
    getTimeWindow: makeOsrdConfSelector('timeWindow'),
    getInterval: makeOsrdConfSelector('interval'),
    getAddedExceptions: makeOsrdConfSelector('addedExceptions'),

    getMapSettings: makeOsrdConfSelector('mapSettings'),
  };
};

const selectors = buildOperationalStudiesConfSelectors();

export const {
  getRollingStockID: getOperationalStudiesRollingStockID,
  getSpeedLimitByTag: getOperationalStudiesSpeedLimitByTag,

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
  getCategory,

  getEditingItemType,
  getTimeWindow,
  getInterval,
  getAddedExceptions,

  getMapSettings,
} = selectors;

export type OperationalStudiesConfSelectors = typeof selectors;

export default selectors;
