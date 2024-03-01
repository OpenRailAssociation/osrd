import buildInfraStateSelectors from 'reducers/infra/selectors';
import { mapViewerSlice } from 'reducers/mapViewer';

const selectors = {
  ...buildInfraStateSelectors(mapViewerSlice),
};

export type MapViewerSelectors = typeof selectors;

export default selectors;
