import type { RootState } from 'reducers';
import { operationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { makeSubSelector } from 'utils/selectors';

import type { OsrdConfState } from '../types';

const buildOperationalStudiesConfSelectors = () => {
  const getOperationalStudiesConf = (state: RootState) => state[operationalStudiesConfSlice.name];
  const makeOsrdConfSelector = makeSubSelector<OsrdConfState>(getOperationalStudiesConf);

  return {
    ...buildCommonConfSelectors(operationalStudiesConfSlice),

    getMapSettings: makeOsrdConfSelector('mapSettings'),
  };
};

const selectors = buildOperationalStudiesConfSelectors();

export const { getMapSettings } = selectors;

export default selectors;
