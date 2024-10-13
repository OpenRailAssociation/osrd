import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { makeSubSelector } from 'utils/selectors';

const buildStdcmConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors<OsrdStdcmConfState>(stdcmConfSlice);
  const makeOsrdConfSelector = makeSubSelector<OsrdStdcmConfState>(commonConfSelectors.getConf);
  return {
    ...commonConfSelectors,
    getStandardStdcmAllowance: makeOsrdConfSelector('standardStdcmAllowance'),
    getTotalMass: makeOsrdConfSelector('totalMass'),
    getTotalLength: makeOsrdConfSelector('totalLength'),
    getMaxSpeed: makeOsrdConfSelector('maxSpeed'),
  };
};

const selectors = buildStdcmConfSelectors();

export type StdcmConfSelectors = typeof selectors;

export default selectors;
