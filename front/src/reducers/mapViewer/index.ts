import { createSlice, type Dispatch } from '@reduxjs/toolkit';

import history from 'main/history';
import { defaultMapSettings, buildMapStateReducer } from 'reducers/globalMap';
import type { MapSettings, Viewport } from 'reducers/globalMap/types';
import type { InfraState } from 'reducers/infra';
import { infraState, buildInfraStateReducers } from 'reducers/infra';
import { gpsRound } from 'utils/helpers';

export type MapViewerState = InfraState & {
  mapSettings: MapSettings;
};

export const mapViewerInitialState: MapViewerState = {
  ...infraState,
  mapSettings: defaultMapSettings,
};

export const mapViewerSlice = createSlice({
  name: 'mapViewer',
  initialState: mapViewerInitialState,
  reducers: {
    ...buildInfraStateReducers<MapViewerState>(),
    ...buildMapStateReducer<MapViewerState>(),
  },
});

export function updateMapViewerViewport(viewport: Partial<Viewport>, updateRouter = false) {
  return (dispatch: Dispatch, getState: () => { mapViewer: MapViewerState }) => {
    dispatch(mapViewerSlice.actions.updateViewport(viewport));

    if (!updateRouter) return;

    const {
      mapViewer: { mapSettings },
    } = getState();
    const latitude = gpsRound(viewport.latitude || mapSettings.viewport.latitude);
    const longitude = gpsRound(viewport.longitude || mapSettings.viewport.longitude);
    const zoom = gpsRound(viewport.zoom || mapSettings.viewport.zoom);
    const bearing = gpsRound(viewport.bearing || mapSettings.viewport.bearing);
    const pitch = gpsRound(viewport.pitch || mapSettings.viewport.pitch);

    history.push(`/map/${latitude}/${longitude}/${zoom}/${bearing}/${pitch}`);
  };
}

export const mapViewerSliceActions = mapViewerSlice.actions;

export type MapViewerSlice = typeof mapViewerSlice;

export default mapViewerSlice.reducer;
