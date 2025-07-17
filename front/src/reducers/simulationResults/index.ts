import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { Occurrence } from 'modules/timetableItem/components/Timetable/types';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import type { ProjectionType, SimulationResultsState } from 'reducers/simulationResults/types';
import { isPacedTrainId } from 'utils/trainId';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  selectedTrainId: undefined,
  trainUsedForProjection: undefined,
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
    updateTrainUsedForProjection(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<
        { trainId: TimetableItemId; exceptionKey?: Occurrence['key'] } | undefined
      >
    ) {
      const { trainId, exceptionKey } = action.payload || {};
      if (!trainId) {
        state.trainUsedForProjection = undefined;
        return;
      }
      if (isPacedTrainId(trainId)) {
        state.trainUsedForProjection = {
          id: trainId,
          exceptionKey,
        };
      } else {
        state.trainUsedForProjection = { id: trainId };
      }
    },
    updateProjectionType(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<ProjectionType>
    ) {
      state.projectionType = action.payload;
    },
  },
});

export const { updateSelectedTrainId, updateTrainUsedForProjection, updateProjectionType } =
  simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
