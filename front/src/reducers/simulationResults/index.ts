import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import { type SimulationResultsState } from 'reducers/simulationResults/types';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  isPlaying: false,
  isUpdating: false,
  selectedTrainId: undefined,
  trainIdUsedForProjection: undefined,
};

export const simulationResultsSlice = createSlice({
  name: 'simulation',
  initialState: simulationResultsInitialState,
  reducers: {
    updateIsPlaying(state: Draft<SimulationResultsState>, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    updateIsUpdating(state: Draft<SimulationResultsState>, action: PayloadAction<boolean>) {
      state.isUpdating = action.payload;
    },
    updateSelectedTrainId(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<number | undefined>
    ) {
      state.selectedTrainId = action.payload;
    },
    updateTrainIdUsedForProjection(
      state: Draft<SimulationResultsState>,
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
} = simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
