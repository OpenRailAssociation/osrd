import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import { type OsrdSimulationState } from 'reducers/osrdsimulation/types';

export const simulationInitialState: OsrdSimulationState = {
  chart: undefined,
  isPlaying: false,
  isUpdating: false,
  selectedTrainId: undefined,
  trainIdUsedForProjection: undefined,
};

export const simulationSlice = createSlice({
  name: 'simulation',
  initialState: simulationInitialState,
  reducers: {
    updateIsPlaying(state: Draft<OsrdSimulationState>, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    updateIsUpdating(state: Draft<OsrdSimulationState>, action: PayloadAction<boolean>) {
      state.isUpdating = action.payload;
    },
    updateSelectedTrainId(
      state: Draft<OsrdSimulationState>,
      action: PayloadAction<number | undefined>
    ) {
      state.selectedTrainId = action.payload;
    },
    updateTrainIdUsedForProjection(
      state: Draft<OsrdSimulationState>,
      action: PayloadAction<number | undefined>
    ) {
      state.trainIdUsedForProjection = action.payload;
    },
  },
});

export const {
  updateIsPlaying,
  updateIsUpdating,
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
} = simulationSlice.actions;

export default simulationSlice.reducer;
