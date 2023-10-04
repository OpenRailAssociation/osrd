import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { MapState } from '.';

export const getMap = (state: RootState) => state.map;

const makeMapStateSelector = makeSubSelector<MapState>(getMap);

export const getUrl = makeMapStateSelector('url');
export const getMapStyle = makeMapStateSelector('mapStyle');
export const getShowIGNBDORTHO = makeMapStateSelector('showIGNBDORTHO');
export const getShowIGNSCAN25 = makeMapStateSelector('showIGNSCAN25');
export const getShowIGNCadastre = makeMapStateSelector('showIGNCadastre');
export const getShowOSM = makeMapStateSelector('showOSM');
export const getShowOSMtracksections = makeMapStateSelector('showOSMtracksections');
export const getTerrain3DExaggeration = makeMapStateSelector('terrain3DExaggeration');
export const getViewport = makeMapStateSelector('viewport');
export const getSignalsSettings = makeMapStateSelector('signalsSettings');
export const getLayersSettings = makeMapStateSelector('layersSettings');
export const getMapSearchMarker = makeMapStateSelector('mapSearchMarker');
