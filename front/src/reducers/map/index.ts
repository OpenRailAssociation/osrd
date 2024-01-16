import type { ViewState } from 'react-map-gl/maplibre';
import type { Position } from '@turf/helpers';
import { createSlice } from '@reduxjs/toolkit';
import type { Dispatch, PayloadAction } from '@reduxjs/toolkit';

import history from 'main/history';

import { gpsRound } from 'utils/helpers';

import type { InfraErrorTypeLabel } from 'applications/editor/components/InfraErrors/types';

import { MAP_URL } from 'common/Map/const';

export type Viewport = ViewState & {
  width: number;
  height: number;
};

export interface MapSearchMarker {
  title: string;
  subtitle?: string;
  lonlat: Position;
}
export interface MapState {
  url: typeof MAP_URL;
  mapStyle: 'normal' | 'dark' | 'blueprint' | 'minimal';
  showIGNBDORTHO: boolean;
  showIGNSCAN25: boolean;
  showIGNCadastre: boolean;
  showOSM: boolean;
  showOSM3dBuildings: boolean;
  showOSMtracksections: boolean;
  terrain3DExaggeration: number;
  smoothTravel: boolean;
  viewport: Viewport;
  layersSettings: {
    bufferstops: boolean;
    electrifications: boolean;
    neutral_sections: boolean;
    detectors: boolean;
    operationalpoints: boolean;
    routes: boolean;
    signals: boolean;
    signalingtype: boolean;
    sncf_psl: boolean;
    speedlimittag: string | null;
    speedlimits: boolean;
    switches: boolean;
    tvds: boolean;
    platforms: boolean;
  };
  issuesSettings?: {
    types: Array<InfraErrorTypeLabel>;
  };
  mapSearchMarker?: MapSearchMarker;
  lineSearchCode?: number;
}

export const mapInitialState: MapState = {
  url: MAP_URL,
  mapStyle: 'normal',
  showIGNBDORTHO: false,
  showIGNSCAN25: false,
  showIGNCadastre: false,
  showOSM: true,
  showOSM3dBuildings: false,
  showOSMtracksections: false,
  terrain3DExaggeration: 0,
  smoothTravel: false,
  viewport: {
    latitude: 48.32,
    longitude: 2.44,
    zoom: 6.2,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, left: 0, bottom: 0, right: 0 },
    width: 0,
    height: 0,
  },
  layersSettings: {
    bufferstops: false,
    electrifications: false,
    neutral_sections: false,
    detectors: false,
    operationalpoints: false,
    routes: false,
    signals: false,
    signalingtype: true,
    sncf_psl: false,
    speedlimits: false,
    speedlimittag: null,
    switches: false,
    tvds: false,
    platforms: true,
  },
  mapSearchMarker: undefined,
  lineSearchCode: undefined,
};

export const mapSlice = createSlice({
  name: 'map',
  initialState: mapInitialState,
  reducers: {
    updateViewportAction: (state, action: PayloadAction<Partial<Viewport>>) => {
      state.viewport = { ...state.viewport, ...action.payload };
    },
    updateMapStyle: (state, action: PayloadAction<MapState['mapStyle']>) => {
      state.mapStyle = action.payload;
    },
    updateMapSearchMarker: (state, action: PayloadAction<MapState['mapSearchMarker']>) => {
      state.mapSearchMarker = action.payload;
    },
    updateLineSearchCode: (state, action: PayloadAction<MapState['lineSearchCode']>) => {
      state.lineSearchCode = action.payload;
    },
    updateShowIGNBDORTHO: (state, action: PayloadAction<MapState['showIGNBDORTHO']>) => {
      state.showIGNBDORTHO = action.payload;
    },
    updateShowIGNSCAN25: (state, action: PayloadAction<MapState['showIGNSCAN25']>) => {
      state.showIGNSCAN25 = action.payload;
    },
    updateShowIGNCadastre: (state, action: PayloadAction<MapState['showIGNCadastre']>) => {
      state.showIGNCadastre = action.payload;
    },
    updateShowOSM: (state, action: PayloadAction<MapState['showOSM']>) => {
      state.showOSM = action.payload;
    },
    updateShowOSM3dBuildings: (state, action: PayloadAction<MapState['showOSM3dBuildings']>) => {
      state.showOSM3dBuildings = action.payload;
    },
    updateShowOSMtracksections: (
      state,
      action: PayloadAction<MapState['showOSMtracksections']>
    ) => {
      state.showOSMtracksections = action.payload;
    },
    updateLayersSettings: (state, action: PayloadAction<MapState['layersSettings']>) => {
      state.layersSettings = action.payload;
    },
    updateIssuesSettings: (state, action: PayloadAction<MapState['issuesSettings']>) => {
      state.issuesSettings = action.payload;
    },
    updateTerrain3DExaggeration: (
      state,
      action: PayloadAction<MapState['terrain3DExaggeration']>
    ) => {
      state.terrain3DExaggeration = action.payload;
    },
    updateSmoothTravel: (state, action: PayloadAction<MapState['smoothTravel']>) => {
      state.smoothTravel = action.payload;
    },
  },
});

// TODO Need this with routing ?
// Functions
export function updateViewport(
  viewport: Partial<Viewport>,
  baseUrl?: string,
  updateRouter = false
) {
  return (dispatch: Dispatch, getState: () => { map: MapState }) => {
    dispatch(mapSlice.actions.updateViewportAction(viewport));
    if (baseUrl !== undefined && updateRouter) {
      const { map } = getState();
      const latitude = gpsRound(viewport.latitude || map.viewport.latitude);
      const longitude = gpsRound(viewport.longitude || map.viewport.longitude);
      const zoom = gpsRound(viewport.zoom || map.viewport.zoom);
      const bearing = gpsRound(viewport.bearing || map.viewport.bearing);
      const pitch = gpsRound(viewport.pitch || map.viewport.pitch);

      history.push(`${baseUrl}/${latitude}/${longitude}/${zoom}/${bearing}/${pitch}`);
    }
  };
}

export const mapSliceActions = mapSlice.actions;
export type MapSliceActions = typeof mapSlice.actions;

export const {
  updateLayersSettings,
  updateLineSearchCode,
  updateMapSearchMarker,
  updateMapStyle,
  updateShowIGNBDORTHO,
  updateShowIGNCadastre,
  updateShowIGNSCAN25,
  updateShowOSM,
  updateShowOSM3dBuildings,
  updateShowOSMtracksections,
  updateTerrain3DExaggeration,
  updateSmoothTravel,
  updateViewportAction,
  updateIssuesSettings,
} = mapSliceActions;

export default mapSlice.reducer;
