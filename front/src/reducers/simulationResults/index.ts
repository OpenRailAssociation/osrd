import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import type { ProjectionType, SimulationResultsState } from 'reducers/simulationResults/types';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  selectedTrainId: undefined,
  trainIdUsedForProjection: undefined,
  projectionType: 'trackProjection',
};

export const simulationResultsSlice = createSlice({
  name: 'simulation',
  initialState: simulationResultsInitialState,
  reducers: {
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
    updateProjectionType(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<ProjectionType>
    ) {
      state.projectionType = action.payload;
    },
  },
});

export const { updateSelectedTrainId, updateTrainIdUsedForProjection, updateProjectionType } =
  simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
