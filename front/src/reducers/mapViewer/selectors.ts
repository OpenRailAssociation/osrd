import { mapViewerSlice } from 'reducers/mapViewer';
import buildInfraStateSelectors from 'reducers/infra/selectors';

const selectors = {
  ...buildInfraStateSelectors(mapViewerSlice),
};

export type MapViewerSelectors = typeof selectors;

export default selectors;
