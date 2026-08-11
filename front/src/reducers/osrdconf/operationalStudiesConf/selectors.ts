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

  return {
    ...buildCommonConfSelectors(operationalStudiesConfSlice),

    getOperationalStudiesConf,

    getName: makeOsrdConfSelector('name'),
    getStartTime: makeOsrdConfSelector('startTime'),
    getLabels: makeOsrdConfSelector('labels'),
    getCategory: makeOsrdConfSelector('category'),

    getRollingStockName: makeOsrdConfSelector('rollingStockName'),
    getRollingStockComfort: makeOsrdConfSelector('rollingStockComfort'),

    getPathSteps,

    getPowerRestrictions: makeOsrdConfSelector('powerRestriction'),

    getEditingTrainType: makeOsrdConfSelector('editingTrainType'),
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
  getRollingStockComfort,
  getRollingStockName,
  getPathSteps,
  getPowerRestrictions,
  getCategory,

  getEditingTrainType,
  getAddedExceptions,

  getMapSettings,
} = selectors;

export type OperationalStudiesConfSelectors = typeof selectors;

export default selectors;
