import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { MapState } from '.';

export const getMap = (state: RootState) => state.map;

export const getRef = makeSubSelector<MapState, 'ref'>(getMap, 'ref');
export const getUrl = makeSubSelector<MapState, 'url'>(getMap, 'url');
export const getMapStyle = makeSubSelector<MapState, 'mapStyle'>(getMap, 'mapStyle');
export const getMapTrackSources = makeSubSelector<MapState, 'mapTrackSources'>(
  getMap,
  'mapTrackSources'
);
export const getShowIGNBDORTHO = makeSubSelector<MapState, 'showIGNBDORTHO'>(
  getMap,
  'showIGNBDORTHO'
);
export const getShowIGNSCAN25 = makeSubSelector<MapState, 'showIGNSCAN25'>(getMap, 'showIGNSCAN25');
export const getShowIGNCadastre = makeSubSelector<MapState, 'showIGNCadastre'>(
  getMap,
  'showIGNCadastre'
);
export const getShowOSM = makeSubSelector<MapState, 'showOSM'>(getMap, 'showOSM');
export const getShowOSMtracksections = makeSubSelector<MapState, 'showOSMtracksections'>(
  getMap,
  'showOSMtracksections'
);
export const getViewport = makeSubSelector<MapState, 'viewport'>(getMap, 'viewport');
export const getFeatureInfoHoverID = makeSubSelector<MapState, 'featureInfoHoverID'>(
  getMap,
  'featureInfoHoverID'
);
export const getFeatureInfoClickID = makeSubSelector<MapState, 'featureInfoClickID'>(
  getMap,
  'featureInfoClickID'
);
export const getFeatureSource = makeSubSelector<MapState, 'featureSource'>(getMap, 'featureSource');
export const getSignalsSettings = makeSubSelector<MapState, 'signalsSettings'>(
  getMap,
  'signalsSettings'
);
export const getLayersSettings = makeSubSelector<MapState, 'layersSettings'>(
  getMap,
  'layersSettings'
);
export const getMapSearchMarker = makeSubSelector<MapState, 'mapSearchMarker'>(
  getMap,
  'mapSearchMarker'
);
