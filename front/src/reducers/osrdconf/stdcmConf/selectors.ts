import { makeSubSelector } from 'utils/selectors';

import type { OsrdStdcmConfState } from 'applications/operationalStudies/consts';

import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';

const buildStdcmConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors<OsrdStdcmConfState>(stdcmConfSlice);
  const makeOsrdConfSelector = makeSubSelector<OsrdStdcmConfState>(commonConfSelectors.getConf);
  return {
    ...commonConfSelectors,
    getStandardStdcmAllowance: makeOsrdConfSelector('standardStdcmAllowance'),
    getMaximumRunTime: makeOsrdConfSelector('maximumRunTime'),
  };
};

const selectors = buildStdcmConfSelectors();

export type StdcmConfSelectors = typeof selectors;

export default selectors;
