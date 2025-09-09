import type { PayloadAction } from '@reduxjs/toolkit';
import type { Position } from 'geojson';
import { useSelector } from 'react-redux';

import { useOsrdContext } from 'common/osrdContext';
import type { RootState } from 'reducers';

import type { LayersSettings, MapSettings, Viewport } from './types';

export const defaultMapSettings: MapSettings = {
  mapStyle: 'normal',
  showIGNBDORTHO: false,
  showIGNSCAN25: false,
  showIGNCadastre: false,
  showOSM: true,
  showOSM3dBuildings: false,
  showOSMtracksections: false,
  terrain3DExaggeration: 0,
  smoothTravel: false,
  layersSettings: {
    buffer_stops: false,
    electrifications: false,
    neutral_sections: false,
    detectors: false,
    operational_points: true,
    routes: false,
    signals: false,
    sncf_psl: false,
    speed_limits: false,
    speedlimittag: null,
    switches: false,
    tvds: false,
    platforms: false,
  },
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
  mapSearchMarker: undefined,
  lineSearchCode: undefined,
};

export function buildMapStateReducer<T extends { mapSettings: MapSettings }>() {
  return {
    updateMapSettings: (state: T, action: PayloadAction<Partial<MapSettings>>) => {
      state.mapSettings = {
        ...state.mapSettings,
        ...action.payload,
      };
    },
    updateLayersSettings: (state: T, action: PayloadAction<Partial<LayersSettings>>) => {
      state.mapSettings = {
        ...state.mapSettings,
        layersSettings: {
          ...state.mapSettings.layersSettings,
          ...action.payload,
        },
      };
    },
    updateViewport: (state: T, action: PayloadAction<Partial<Viewport>>) => {
      state.mapSettings = {
        ...state.mapSettings,
        viewport: {
          ...state.mapSettings.viewport,
          ...action.payload,
        },
      };
    },
    selectSearchResult: (
      state: T,
      action: PayloadAction<{ label: string; coordinates: Position }>
    ) => {
      const { label, coordinates } = action.payload;
      state.mapSettings = {
        ...state.mapSettings,
        viewport: {
          ...state.mapSettings.viewport,
          longitude: coordinates[0],
          latitude: coordinates[1],
          zoom: 16,
        },
        mapSearchMarker: {
          title: label,
          lonlat: coordinates,
        },
      };
    },
    removeMapSearchMarker: (state: T) => {
      state.mapSettings = {
        ...state.mapSettings,
        mapSearchMarker: undefined,
        lineSearchCode: undefined,
      };
    },
  };
}

export const useMapSettings = (): MapSettings => {
  const { selectors } = useOsrdContext();

  if (!('getMapSettings' in selectors)) {
    throw new Error('getMapSettings selector is not available in this context');
  }

  return useSelector(selectors.getMapSettings as (state: RootState) => MapSettings);
};

export const useMapSettingsActions = () => {
  const { slice } = useOsrdContext();

  if (!slice.actions.updateMapSettings) {
    throw new Error('updateMapSettings action is not available in this context');
  }

  return {
    updateMapSettings: slice.actions.updateMapSettings,
    updateViewport: slice.actions.updateViewport,
    updateLayersSettings: slice.actions.updateLayersSettings,
    selectSearchResult: slice.actions.selectSearchResult,
    removeMapSearchMarker: slice.actions.removeMapSearchMarker,
  };
};
