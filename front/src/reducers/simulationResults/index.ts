import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { OccurrenceId, PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import type { ProjectionType, SimulationResultsState } from 'reducers/simulationResults/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  selectedTrainId: undefined,
  trainIdUsedForProjection: undefined,
  projectionType: 'trackProjection',
  displayOnlyPathSteps: false,
};

export const simulationResultsSlice = createSlice({
  name: 'simulation',
  initialState: simulationResultsInitialState,
  reducers: {
    toggleDisplayOnlyPathSteps(state: Draft<SimulationResultsState>) {
      state.displayOnlyPathSteps = !state.displayOnlyPathSteps;
    },
    updateSelectedTrainId(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainId | undefined>
    ) {
      state.selectedTrainId = action.payload;
    },
    updateTrainIdUsedForProjection(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainScheduleId | PacedTrainId | OccurrenceId | undefined>
    ) {
      state.trainIdUsedForProjection = action.payload;
    },
    updateProjectionType(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<ProjectionType>
    ) {
      state.projectionType = action.payload;
    },
    unsetTrainIdsMatching(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainScheduleId | PacedTrainId | OccurrenceId>
    ) {
      const idToUnset = action.payload;

      const isIdMatchingOccurence = (
        id: TrainScheduleId | OccurrenceId | PacedTrainId | undefined
      ) => id && isOccurrenceId(id) && extractPacedTrainIdFromOccurrenceId(id) === idToUnset;

      if (
        state.trainIdUsedForProjection === idToUnset ||
        isIdMatchingOccurence(state.trainIdUsedForProjection)
      ) {
        state.trainIdUsedForProjection = undefined;
      }
      if (state.selectedTrainId === idToUnset || isIdMatchingOccurence(state.selectedTrainId)) {
        state.selectedTrainId = undefined;
      }
    },
    unsetTrainIdsMatchingMissingOccurencesOf(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<{ pacedTrainId: PacedTrainId; occurrencesPresent: OccurrenceId[] }>
    ) {
      const { pacedTrainId, occurrencesPresent } = action.payload;

      const isIdMatchingMissingOccurence = (
        id: TrainScheduleId | OccurrenceId | PacedTrainId | undefined
      ) =>
        id &&
        isOccurrenceId(id) &&
        extractPacedTrainIdFromOccurrenceId(id) === pacedTrainId &&
        !occurrencesPresent.includes(id);

      if (isIdMatchingMissingOccurence(state.trainIdUsedForProjection)) {
        state.trainIdUsedForProjection = undefined;
      }
      if (isIdMatchingMissingOccurence(state.selectedTrainId)) {
        state.selectedTrainId = undefined;
      }
    },
  },
});

export const {
  toggleDisplayOnlyPathSteps,
  updateSelectedTrainId,
  updateTrainIdUsedForProjection,
  updateProjectionType,
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurencesOf,
} = simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
