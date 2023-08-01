/* eslint-disable default-case */
import { AnyAction, Dispatch } from 'redux';
import { MapProps, ViewState } from 'react-map-gl';
import produce from 'immer';
import { transformRequest as helperTransformRequest, gpsRound } from 'utils/helpers';
import history from 'main/history';
import { MAP_URL } from 'common/Map/const';
import { Position } from '@turf/helpers';

// Action Types
export const UPDATE_VIEWPORT = 'map/UPDATE_VIEWPORT';
export const UPDATE_TRANSFORM_REQUEST = 'map/UPDATE_TRANSFORM_REQUEST';
export const UPDATE_MAPSTYLE = 'map/UPDATE_MAPSTYLE';
export const UPDATE_MAP_TRACK_SOURCES = 'map/UPDATE_MAP_TRACK_SOURCES';
export const UPDATE_MAP_SEARCH_MARKER = 'map/UPDATE_MAP_SEARCH_MARKER';
export const UPDATE_LINE_SEARCH_CODE = 'map/UPDATE_LINE_SEARCH_CODE';
export const UPDATE_SHOW_IGN_BD_ORTHO = 'map/UPDATE_SHOW_IGN_BD_ORTHO';
export const UPDATE_SHOW_IGN_SCAN25 = 'map/UPDATE_SHOW_IGN_SCAN25';
export const UPDATE_SHOW_IGN_CADASTRE = 'map/UPDATE_SHOW_IGN_CADASTRE';
export const UPDATE_SHOW_OSM = 'map/UPDATE_SHOW_OSM';
export const UPDATE_SHOW_OSM_TRACKSECTIONS = 'map/UPDATE_SHOW_OSM_TRACKSECTIONS';
export const UPDATE_FEATURE_INFO_HOVER = 'map/UPDATE_FEATURE_INFO_HOVER';
export const UPDATE_FEATURE_INFO_CLICK = 'map/UPDATE_FEATURE_INFO_CLICK';
export const UPDATE_LAYERS_SETTINGS = 'osrdconf/UPDATE_LAYERS_SETTINGS';
export const UPDATE_SIGNALS_SETTINGS = 'osrdconf/UPDATE_SIGNALS_SETTINGS';

const transformRequest: MapProps['transformRequest'] = (url, resourceType) =>
  helperTransformRequest(url as string, resourceType as string, MAP_URL as string);

export type Viewport = ViewState & {
  transformRequest: MapProps['transformRequest'];
  width: number;
  height: number;
};

export interface MapSearchMarker {
  title: string;
  subtitle?: string;
  lonlat: Position;
}
export interface MapState {
  ref: unknown;
  url: typeof MAP_URL;
  mapStyle: 'normal' | 'dark' | 'blueprint';
  mapTrackSources: 'geographic' | 'schematic';
  showIGNBDORTHO: boolean;
  showIGNSCAN25: boolean;
  showIGNCadastre: boolean;
  showOSM: boolean;
  showOSMtracksections: boolean;
  viewport: Viewport;
  featureInfoHoverID: unknown;
  featureInfoClickID: unknown;
  featureSource: unknown;
  signalsSettings: {
    all: boolean;
    stops: boolean;
    lights: boolean;
    tivs: boolean;
  };
  layersSettings: {
    bufferstops: boolean;
    catenaries: boolean;
    neutral_sections: boolean;
    detectors: boolean;
    operationalpoints: boolean;
    routes: boolean;
    signalingtype: boolean;
    sncf_lpv: boolean;
    speedlimittag: unknown;
    speedlimits: boolean;
    switches: boolean;
    tvds: boolean;
    errors: boolean;
  };
  mapSearchMarker?: MapSearchMarker;
  lineSearchCode?: number;
}

export const initialState: MapState = {
  ref: undefined,
  url: MAP_URL,
  mapStyle: 'normal',
  mapTrackSources: 'geographic',
  showIGNBDORTHO: false,
  showIGNSCAN25: false,
  showIGNCadastre: false,
  showOSM: true,
  showOSMtracksections: false,
  viewport: {
    latitude: 48.32,
    longitude: 2.44,
    zoom: 6.2,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, left: 0, bottom: 0, right: 0 },
    width: 0,
    height: 0,
    transformRequest,
  },
  featureInfoHoverID: undefined,
  featureInfoClickID: undefined,
  featureSource: undefined,
  signalsSettings: {
    all: false,
    stops: true,
    lights: false,
    tivs: false,
  },
  layersSettings: {
    bufferstops: false,
    catenaries: false,
    neutral_sections: false,
    detectors: false,
    operationalpoints: false,
    routes: false,
    signalingtype: true,
    sncf_lpv: false,
    speedlimittag: undefined,
    speedlimits: false,
    switches: false,
    tvds: false,
    errors: false,
  },
  mapSearchMarker: undefined,
  lineSearchCode: undefined,
};

// Reducer
export default function reducer(inputState: MapState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_VIEWPORT:
        draft.viewport = { ...draft.viewport, ...action.viewport };
        break;
      case UPDATE_TRANSFORM_REQUEST:
        draft.viewport.transformRequest = transformRequest;
        break;
      case UPDATE_MAPSTYLE:
        draft.mapStyle = action.mapStyle;
        break;
      case UPDATE_MAP_TRACK_SOURCES:
        draft.mapTrackSources = action.mapTrackSources;
        break;
      case UPDATE_MAP_SEARCH_MARKER:
        draft.mapSearchMarker = action.mapSearchMarker;
        break;
      case UPDATE_LINE_SEARCH_CODE:
        draft.lineSearchCode = action.lineSearchCode;
        break;
      case UPDATE_SHOW_IGN_BD_ORTHO:
        draft.showIGNBDORTHO = action.showIGNBDORTHO;
        break;
      case UPDATE_SHOW_IGN_SCAN25:
        draft.showIGNSCAN25 = action.showIGNSCAN25;
        break;
      case UPDATE_SHOW_IGN_CADASTRE:
        draft.showIGNCadastre = action.showIGNCadastre;
        break;
      case UPDATE_SHOW_OSM:
        draft.showOSM = action.showOSM;
        break;
      case UPDATE_SHOW_OSM_TRACKSECTIONS:
        draft.showOSMtracksections = action.showOSMtracksections;
        break;
      case UPDATE_FEATURE_INFO_HOVER:
        draft.featureSource = action.featureSource;
        draft.featureInfoHoverID = action.featureInfoHoverID;
        break;
      case UPDATE_FEATURE_INFO_CLICK:
        draft.featureInfoClickID = action.featureInfoClickID;
        break;
      case UPDATE_LAYERS_SETTINGS:
        draft.layersSettings = action.layersSettings;
        break;
      case UPDATE_SIGNALS_SETTINGS:
        draft.signalsSettings = action.signalsSettings;
        break;
    }
  });
}

// Action Creators
function updateViewportAction(viewport: Partial<Viewport>) {
  return {
    type: UPDATE_VIEWPORT,
    viewport,
  };
}

// Functions
export function updateViewport(
  viewport: Partial<Viewport>,
  baseUrl?: string,
  updateRouter = false
) {
  return (dispatch: Dispatch, getState: () => { map: MapState }) => {
    dispatch(updateViewportAction(viewport));
    if (baseUrl !== undefined && updateRouter) {
      const { map } = getState();
      history.push(
        `${baseUrl}/${gpsRound(viewport.latitude || map.viewport.latitude)}/${gpsRound(
          viewport.longitude || map.viewport.longitude
        )}/${gpsRound(viewport.zoom || map.viewport.zoom)}/${gpsRound(
          viewport.bearing || map.viewport.bearing
        )}/${gpsRound(viewport.pitch || map.viewport.pitch)}`
      );
    }
  };
}

export function updateMapStyle(mapStyle: MapState['mapStyle']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MAPSTYLE,
      mapStyle,
    });
  };
}

export function updateMapTrackSources(mapTrackSources: MapState['mapTrackSources']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_MAP_TRACK_SOURCES,
      mapTrackSources,
    });
  };
}

export function updateMapSearchMarker(mapSearchMarker: MapState['mapSearchMarker']) {
  return {
    type: UPDATE_MAP_SEARCH_MARKER,
    mapSearchMarker,
  };
}

export function updateShowIGNBDORTHO(showIGNBDORTHO: MapState['showIGNBDORTHO']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOW_IGN_BD_ORTHO,
      showIGNBDORTHO,
    });
  };
}

export function updateShowIGNSCAN25(showIGNSCAN25: MapState['showIGNSCAN25']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOW_IGN_SCAN25,
      showIGNSCAN25,
    });
  };
}

export function updateShowIGNCadastre(showIGNCadastre: MapState['showIGNCadastre']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOW_IGN_CADASTRE,
      showIGNCadastre,
    });
  };
}

export function updateShowOSM(showOSM: MapState['showOSM']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOW_OSM,
      showOSM,
    });
  };
}

export function updateShowOSMtracksections(showOSMtracksections: MapState['showOSMtracksections']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SHOW_OSM_TRACKSECTIONS,
      showOSMtracksections,
    });
  };
}

export function updateFeatureInfoHover(featureInfoHoverID: unknown, featureSource: unknown) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_HOVER,
      featureInfoHoverID,
      featureSource,
    });
  };
}

export function updateFeatureInfoClick(featureInfoClickID: unknown) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_CLICK,
      featureInfoClickID,
    });
  };
}

export function updateLayersSettings(layersSettings: MapState['layersSettings']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_LAYERS_SETTINGS,
      layersSettings,
    });
  };
}

export function updateSignalsSettings(signalsSettings: MapState['signalsSettings']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_SIGNALS_SETTINGS,
      signalsSettings,
    });
  };
}

export function updateLineSearchCode(lineSearchCode: MapState['lineSearchCode']) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_LINE_SEARCH_CODE,
      lineSearchCode,
    });
  };
}
