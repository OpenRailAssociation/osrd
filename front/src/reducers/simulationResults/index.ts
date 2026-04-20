import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';

import type { OccurrenceId, PacedTrainId, TrainId } from 'reducers/osrdconf/types';
import type { ProjectionType, SimulationResultsState } from 'reducers/simulationResults/types';
import { extractPacedTrainIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

export const simulationResultsInitialState: SimulationResultsState = {
  chart: undefined,
  selectedTrainId: undefined,
  hoveredTrainId: undefined,
  trainIdUsedForProjection: undefined,
  projectionType: 'trackProjection',
  displayOnlyPathSteps: false,
  isSimulationEnabled: true,
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
    updateHoveredTrainId(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainId | undefined>
    ) {
      state.hoveredTrainId = action.payload;
    },
    updateTrainIdUsedForProjection(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<TrainId | undefined>
    ) {
      state.trainIdUsedForProjection = action.payload;
    },
    updateProjectionType(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<ProjectionType>
    ) {
      state.projectionType = action.payload;
    },
    toggleSimulationEnabled(state: Draft<SimulationResultsState>) {
      state.isSimulationEnabled = !state.isSimulationEnabled;
      // When switching to input mode, force interPR projection
      if (!state.isSimulationEnabled) {
        state.projectionType = 'operationalPointProjection';
      }
    },
    unsetTrainIdsMatching(state: Draft<SimulationResultsState>, action: PayloadAction<TrainId>) {
      const idToUnset = action.payload;

      const isIdMatchingOccurrence = (id: TrainId | undefined) =>
        id && isOccurrenceId(id) && extractPacedTrainIdFromOccurrenceId(id) === idToUnset;

      if (
        state.trainIdUsedForProjection === idToUnset ||
        isIdMatchingOccurrence(state.trainIdUsedForProjection)
      ) {
        state.trainIdUsedForProjection = undefined;
      }
      if (state.selectedTrainId === idToUnset || isIdMatchingOccurrence(state.selectedTrainId)) {
        state.selectedTrainId = undefined;
      }
      if (state.hoveredTrainId === idToUnset || isIdMatchingOccurrence(state.hoveredTrainId)) {
        state.hoveredTrainId = undefined;
      }
    },
    unsetTrainIdsMatchingMissingOccurrencesOf(
      state: Draft<SimulationResultsState>,
      action: PayloadAction<{ pacedTrainId: PacedTrainId; occurrencesPresent: OccurrenceId[] }>
    ) {
      const { pacedTrainId, occurrencesPresent } = action.payload;

      const isIdMatchingMissingOccurrence = (id: TrainId | undefined) =>
        id &&
        isOccurrenceId(id) &&
        extractPacedTrainIdFromOccurrenceId(id) === pacedTrainId &&
        !occurrencesPresent.includes(id);

      if (isIdMatchingMissingOccurrence(state.trainIdUsedForProjection)) {
        state.trainIdUsedForProjection = undefined;
      }
      if (isIdMatchingMissingOccurrence(state.selectedTrainId)) {
        state.selectedTrainId = undefined;
      }
      if (isIdMatchingMissingOccurrence(state.hoveredTrainId)) {
        state.hoveredTrainId = undefined;
      }
    },
  },
});

export const {
  toggleDisplayOnlyPathSteps,
  toggleSimulationEnabled,
  updateSelectedTrainId,
  updateHoveredTrainId,
  updateTrainIdUsedForProjection,
  updateProjectionType,
  unsetTrainIdsMatching,
  unsetTrainIdsMatchingMissingOccurrencesOf,
} = simulationResultsSlice.actions;

export default simulationResultsSlice.reducer;
