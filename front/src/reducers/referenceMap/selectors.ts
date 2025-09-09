import type { RootState } from 'reducers';
import buildInfraStateSelectors from 'reducers/infra/selectors';
import { referenceMapSlice } from 'reducers/referenceMap';
import { makeSubSelector } from 'utils/selectors';

const getReferenceMap = (state: RootState) => state.referenceMap;
const makeReferenceMapSelector = makeSubSelector(getReferenceMap);
const getMapSettings = makeReferenceMapSelector('mapSettings');

const selectors = {
  ...buildInfraStateSelectors(referenceMapSlice),
  getMapSettings,
};

export type ReferenceMapSelectors = typeof selectors;

export default selectors;
