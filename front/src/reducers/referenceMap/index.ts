import { createSlice, type Dispatch } from '@reduxjs/toolkit';
import type { MapLibreEvent } from 'maplibre-gl';

import history from 'main/history';
import { defaultMapSettings, buildMapStateReducer } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import type { InfraState } from 'reducers/infra';
import { infraState, buildInfraStateReducers } from 'reducers/infra';
import { gpsRound } from 'utils/helpers';

export type ReferenceMapState = InfraState & {
  mapSettings: MapSettings;
};

export const referenceMapInitialState: ReferenceMapState = {
  ...infraState,
  mapSettings: defaultMapSettings,
};

export const referenceMapSlice = createSlice({
  name: 'referenceMap',
  initialState: referenceMapInitialState,
  reducers: {
    ...buildInfraStateReducers<ReferenceMapState>(),
    ...buildMapStateReducer<ReferenceMapState>(),
  },
});

export function updateReferenceMapViewport(viewport: Partial<Viewport>) {
  return (dispatch: Dispatch) => {
    dispatch(referenceMapSlice.actions.updateViewport(viewport));
  };
}

export function syncReferenceMapRouterViewport(event: MapLibreEvent) {
  return (dispatch: Dispatch) => {
    void dispatch;

    const center = event.target.getCenter();
    const latitude = gpsRound(center.lat);
    const longitude = gpsRound(center.lng);
    const zoom = gpsRound(event.target.getZoom());
    const bearing = gpsRound(event.target.getBearing());
    const pitch = gpsRound(event.target.getPitch());

    history.push(`/map/${latitude}/${longitude}/${zoom}/${bearing}/${pitch}`);
  };
}

export const referenceMapSliceActions = referenceMapSlice.actions;

export type ReferenceMapSlice = typeof referenceMapSlice;

export default referenceMapSlice.reducer;
