import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { MapState } from '.';

export const getMap = (state: RootState) => state.map;

export const getRef = makeSubSelector<MapState>(getMap, 'ref');
export const getUrl = makeSubSelector<MapState>(getMap, 'url');
export const getMapStyle = makeSubSelector<MapState>(getMap, 'mapStyle');
export const getMapTrackSources = makeSubSelector<MapState>(getMap, 'mapTrackSources');
export const getShowIGNBDORTHO = makeSubSelector<MapState>(getMap, 'showIGNBDORTHO');
export const getShowIGNSCAN25 = makeSubSelector<MapState>(getMap, 'showIGNSCAN25');
export const getShowIGNCadastre = makeSubSelector<MapState>(getMap, 'showIGNCadastre');
export const getShowOSM = makeSubSelector<MapState>(getMap, 'showOSM');
export const getShowOSMtracksections = makeSubSelector<MapState>(getMap, 'showOSMtracksections');
export const getViewport = makeSubSelector<MapState>(getMap, 'viewport');
export const getFeatureInfoHoverID = makeSubSelector<MapState>(getMap, 'featureInfoHoverID');
export const getFeatureInfoClickID = makeSubSelector<MapState>(getMap, 'featureInfoClickID');
export const getFeatureSource = makeSubSelector<MapState>(getMap, 'featureSource');
export const getSignalsSettings = makeSubSelector<MapState>(getMap, 'signalsSettings');
export const getLayersSettings = makeSubSelector<MapState>(getMap, 'layersSettings');
export const getMapSearchMarker = makeSubSelector<MapState>(getMap, 'mapSearchMarker');
