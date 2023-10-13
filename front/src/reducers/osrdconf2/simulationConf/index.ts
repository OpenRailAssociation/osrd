import { createSlice, ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import { OsrdConfState } from 'applications/operationalStudies/consts';
import {
  defaultCommonConf,
  buildCommonOsrdConfReducers,
  addCommonOsrdConfMatchers,
  registerUpdateInfraIDListener,
} from '../common';

export const simulationConfInitialState = defaultCommonConf;

export const simulationConfSlice = createSlice({
  name: 'simulationconf',
  initialState: simulationConfInitialState,
  reducers: { ...buildCommonOsrdConfReducers<OsrdConfState>() },
  extraReducers: (builder) => {
    addCommonOsrdConfMatchers(builder);
  },
});

export const simulationConfSliceActions = simulationConfSlice.actions;

export function registerSimulationUpdateInfraIDListeners(listener: ListenerMiddlewareInstance) {
  registerUpdateInfraIDListener(listener, simulationConfSliceActions.updateInfraID);
}

export type simulationConfSliceType = typeof simulationConfSlice;

export type simulationConfSliceActionsType = typeof simulationConfSliceActions;

export default simulationConfSlice.reducer;
