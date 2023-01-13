import { RootState } from 'reducers';

export const getRef = (state: RootState) => state.map.ref;
export const getUrl = (state: RootState) => state.map.url;
export const getMapStyle = (state: RootState) => state.map.mapStyle;
export const getMapTrackSources = (state: RootState) => state.map.mapTrackSources;
export const getShowIGNBDORTHO = (state: RootState) => state.map.showIGNBDORTHO;
export const getShowIGNSCAN25 = (state: RootState) => state.map.showIGNSCAN25;
export const getShowIGNCadastre = (state: RootState) => state.map.showIGNCadastre;
export const getShowOSM = (state: RootState) => state.map.showOSM;
export const getShowOSMtracksections = (state: RootState) => state.map.showOSMtracksections;
export const getViewport = (state: RootState) => state.map.viewport;
export const getFeatureInfoHoverID = (state: RootState) => state.map.featureInfoHoverID;
export const getFeatureInfoClickID = (state: RootState) => state.map.featureInfoClickID;
export const getFeatureSource = (state: RootState) => state.map.featureSource;
export const getSignalsSettings = (state: RootState) => state.map.signalsSettings;
export const getLayersSettings = (state: RootState) => state.map.layersSettings;
export const getMapSearchMarker = (state: RootState) => state.map.mapSearchMarker;
