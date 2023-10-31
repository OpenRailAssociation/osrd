import type { OsrdConfState } from 'applications/operationalStudies/consts';

import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';

const buildOperationalStudiesConfSelectors = () => {
  const commonConfSelectors = buildCommonConfSelectors<OsrdConfState>(operationalStudiesConfSlice);
  return {
    ...commonConfSelectors,
  };
};

const selectors = buildOperationalStudiesConfSelectors();

export type OperationalStudiesConfSelectors = typeof selectors;

export default selectors;
