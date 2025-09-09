import type { Dispatch, PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import { MAP_URL } from 'common/Map/const';
import history from 'main/history';
import { buildMapStateReducer, defaultMapSettings } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { gpsRound } from 'utils/helpers';

export type MapState = {
  url: typeof MAP_URL;
  mapSettings: MapSettings;
};

export const mapInitialState: MapState = {
  url: MAP_URL,
  mapSettings: defaultMapSettings,
};

export const mapSlice = createSlice({
  name: 'map',
  initialState: mapInitialState,
  reducers: {
    ...buildMapStateReducer<MapState>(),
    updateViewportAction: (state, action: PayloadAction<Partial<Viewport>>) => {
      state.mapSettings.viewport = { ...state.mapSettings.viewport, ...action.payload };
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
      const latitude = gpsRound(viewport.latitude || map.mapSettings.viewport.latitude);
      const longitude = gpsRound(viewport.longitude || map.mapSettings.viewport.longitude);
      const zoom = gpsRound(viewport.zoom || map.mapSettings.viewport.zoom);
      const bearing = gpsRound(viewport.bearing || map.mapSettings.viewport.bearing);
      const pitch = gpsRound(viewport.pitch || map.mapSettings.viewport.pitch);

      history.push(`${baseUrl}/${latitude}/${longitude}/${zoom}/${bearing}/${pitch}`);
    }
  };
}

export const mapSliceActions = mapSlice.actions;
export type MapSliceActions = typeof mapSlice.actions;

export default mapSlice.reducer;
