/* eslint-disable default-case */
import produce from 'immer';
import { transformRequest, gpsRound } from 'utils/helpers';
import history from 'main/history';
import { MAP_URL } from 'common/Map/const';

// Action Types
export const UPDATE_VIEWPORT = 'map/UPDATE_VIEWPORT';
export const UPDATE_TRANSFORM_REQUEST = 'map/UPDATE_TRANSFORM_REQUEST';
export const UPDATE_MAPSTYLE = 'map/UPDATE_MAPSTYLE';
export const UPDATE_MAP_TRACK_SOURCES = 'map/UPDATE_MAP_TRACK_SOURCES';
export const UPDATE_MAP_SEARCH_MARKER = 'map/UPDATE_MAP_SEARCH_MARKER';
export const UPDATE_SHOW_OSM = 'map/UPDATE_SHOW_OSM';
export const UPDATE_SHOW_OSM_TRACKSECTIONS = 'map/UPDATE_SHOW_OSM_TRACKSECTIONS';
export const UPDATE_FEATURE_INFO_HOVER = 'map/UPDATE_FEATURE_INFO_HOVER';
export const UPDATE_FEATURE_INFO_CLICK = 'map/UPDATE_FEATURE_INFO_CLICK';
export const UPDATE_LAYERS_SETTINGS = 'osrdconf/UPDATE_LAYERS_SETTINGS';
export const UPDATE_SIGNALS_SETTINGS = 'osrdconf/UPDATE_SIGNALS_SETTINGS';

// Reducer
export const initialState = {
  ref: undefined,
  url: MAP_URL,
  mapStyle: 'normal',
  mapTrackSources: 'geographic',
  showOSM: true,
  showOSMtracksections: false,
  viewport: {
    latitude: 48.32,
    longitude: 2.44,
    zoom: 6.2,
    bearing: 0,
    pitch: 0,
    transformRequest: (url, resourceType) => transformRequest(url, resourceType, MAP_URL),
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
    detectors: false,
    operationalpoints: false,
    routes: false,
    signalingtype: true,
    speedlimittag: undefined,
    speedlimits: false,
    switches: false,
    tvds: false,
  },
  mapSearchMarker: undefined,
};

export default function reducer(inputState, action) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_VIEWPORT:
        draft.viewport = { ...draft.viewport, ...action.viewport };
        break;
      case UPDATE_TRANSFORM_REQUEST:
        draft.viewport.transformRequest = (url, resourceType) =>
          transformRequest(url, resourceType, MAP_URL);
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
function updateViewportAction(viewport) {
  return {
    type: UPDATE_VIEWPORT,
    viewport,
  };
}

// Functions
export function updateViewport(viewport, baseUrl, updateRouter = true) {
  return (dispatch) => {
    dispatch(updateViewportAction(viewport));
    if (baseUrl !== undefined && updateRouter) {
      history.push(
        `${baseUrl}/${gpsRound(viewport.latitude)}/${gpsRound(viewport.longitude)}/${gpsRound(
          viewport.zoom
        )}/${gpsRound(viewport.bearing)}/${gpsRound(viewport.pitch)}`
      );
    }
  };
}

export function updateMapStyle(mapStyle) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MAPSTYLE,
      mapStyle,
    });
  };
}

export function updateMapTrackSources(mapTrackSources) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MAP_TRACK_SOURCES,
      mapTrackSources,
    });
  };
}

export function updateMapSearchMarker(mapSearchMarker) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_MAP_SEARCH_MARKER,
      mapSearchMarker,
    });
  };
}

export function updateShowOSM(showOSM) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SHOW_OSM,
      showOSM,
    });
  };
}

export function updateShowOSMtracksections(showOSMtracksections) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SHOW_OSM_TRACKSECTIONS,
      showOSMtracksections,
    });
  };
}

export function updateFeatureInfoHover(featureInfoHoverID, featureSource) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_HOVER,
      featureInfoHoverID,
      featureSource,
    });
  };
}

export function updateFeatureInfoClick(featureInfoClickID, featureSource) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_CLICK,
      featureInfoClickID,
      featureSource,
    });
  };
}

export function updateLayersSettings(layersSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_LAYERS_SETTINGS,
      layersSettings,
    });
  };
}

export function updateSignalsSettings(signalsSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SIGNALS_SETTINGS,
      signalsSettings,
    });
  };
}
