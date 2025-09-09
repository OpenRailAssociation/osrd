import { createSlice, type Dispatch } from '@reduxjs/toolkit';

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

export function updateReferenceMapViewport(viewport: Partial<Viewport>, updateRouter = false) {
  return (dispatch: Dispatch, getState: () => { referenceMap: ReferenceMapState }) => {
    dispatch(referenceMapSlice.actions.updateViewport(viewport));

    if (!updateRouter) return;

    const {
      referenceMap: { mapSettings },
    } = getState();
    const latitude = gpsRound(viewport.latitude || mapSettings.viewport.latitude);
    const longitude = gpsRound(viewport.longitude || mapSettings.viewport.longitude);
    const zoom = gpsRound(viewport.zoom || mapSettings.viewport.zoom);
    const bearing = gpsRound(viewport.bearing || mapSettings.viewport.bearing);
    const pitch = gpsRound(viewport.pitch || mapSettings.viewport.pitch);

    history.push(`/map/${latitude}/${longitude}/${zoom}/${bearing}/${pitch}`);
  };
}

export const referenceMapSliceActions = referenceMapSlice.actions;

export type ReferenceMapSlice = typeof referenceMapSlice;

export default referenceMapSlice.reducer;
