import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';

import type { OsrdConfState } from '../consts';

const buildOperationalStudiesConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors<OsrdConfState>(operationalStudiesConfSlice);
  return {
    ...commonConfSelectors,
  };
};

const selectors = buildOperationalStudiesConfSelectors();

export type OperationalStudiesConfSelectors = typeof selectors;

export default selectors;
