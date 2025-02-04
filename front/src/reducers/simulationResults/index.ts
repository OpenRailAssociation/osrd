import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { type SimulationResultsState } from 'reducers/simulationResults/types';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  isPlaying: false,
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
    updateSelectedTrainId(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainId | undefined>
    ) {
      state.selectedTrainId = action.payload;
    },
    updateTrainIdUsedForProjection(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TimetableItemId | undefined>
    ) {
      state.trainIdUsedForProjection = action.payload;
    },
  },
});

export const { updateIsPlaying, updateSelectedTrainId, updateTrainIdUsedForProjection } =
  simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
