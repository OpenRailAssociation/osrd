import { createSlice } from '@reduxjs/toolkit';
import { OsrdConfState } from 'applications/operationalStudies/consts';
import { defaultCommonConf, buildCommonConfReducers } from '../common';

export const simulationConfInitialState = defaultCommonConf;

export const simulationConfSlice = createSlice({
  name: 'simulationConf',
  initialState: simulationConfInitialState,
  reducers: { ...buildCommonConfReducers<OsrdConfState>() },
});

export const simulationConfSliceActions = simulationConfSlice.actions;

export type simulationConfSliceType = typeof simulationConfSlice;

export type simulationConfSliceActionsType = typeof simulationConfSliceActions;

export default simulationConfSlice.reducer;
