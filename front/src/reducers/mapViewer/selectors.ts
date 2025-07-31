import type { RootState } from 'reducers';
import buildInfraStateSelectors from 'reducers/infra/selectors';
import { mapViewerSlice } from 'reducers/mapViewer';
import { makeSubSelector } from 'utils/selectors';

const getMapViewer = (state: RootState) => state.mapViewer;
const makeMapViewerSelector = makeSubSelector(getMapViewer);
const getMapSettings = makeMapViewerSelector('mapSettings');

const selectors = {
  ...buildInfraStateSelectors(mapViewerSlice),
  getMapSettings,
};

export type MapViewerSelectors = typeof selectors;

export default selectors;
