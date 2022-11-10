/* eslint-disable default-case */
import { AnyAction, Dispatch } from 'redux';
import { MapRequest, FlyToInterpolator } from 'react-map-gl';
import produce from 'immer';
import { transformRequest as helperTransformRequest, gpsRound } from 'utils/helpers';
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

function transformRequest(url?: string, resourceType?: string) {
  return helperTransformRequest(
    url as string,
    resourceType as string,
    MAP_URL as string
  ) as MapRequest;
}

export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
  transitionDuration?: number | 'auto';
  transitionInterpolator?: FlyToInterpolator;
  transformRequest: typeof transformRequest;
}

export interface MapSearchMarker {
  title: string;
  subtitle: string;
  lonlat: [number, number];
}
export interface MapState {
  ref: unknown;
  url: typeof MAP_URL;
  mapStyle: string;
  mapTrackSources: string;
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
    detectors: boolean;
    operationalpoints: boolean;
    routes: boolean;
    signalingtype: boolean;
    sncf_lpv: boolean;
    speedlimittag: unknown;
    speedlimits: boolean;
    switches: boolean;
    tvds: boolean;
  };
  mapSearchMarker?: MapSearchMarker;
}

export const initialState: MapState = {
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
    detectors: false,
    operationalpoints: false,
    routes: false,
    signalingtype: true,
    sncf_lpv: false,
    speedlimittag: undefined,
    speedlimits: false,
    switches: false,
    tvds: false,
  },
  mapSearchMarker: undefined,
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
export function updateViewport(viewport: Partial<Viewport>, baseUrl?: string, updateRouter = true) {
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

export function updateFeatureInfoClick(featureInfoClickID: unknown, featureSource: unknown) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_CLICK,
      featureInfoClickID,
      featureSource,
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
