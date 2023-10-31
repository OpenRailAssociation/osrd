import { createSlice } from '@reduxjs/toolkit';

import type { InfraState } from 'reducers/infra';
import { infraState, buildInfraStateReducers } from 'reducers/infra';

export interface MapViewerState extends InfraState {}

export const mapViewerInitialState: MapViewerState = {
  ...infraState,
};

export const mapViewerSlice = createSlice({
  name: 'mapViewer',
  initialState: mapViewerInitialState,
  reducers: {
    ...buildInfraStateReducers<MapViewerState>(),
  },
});

export const mapViewerSliceActions = mapViewerSlice.actions;

export type MapViewerSlice = typeof mapViewerSlice;

export default mapViewerSlice.reducer;
