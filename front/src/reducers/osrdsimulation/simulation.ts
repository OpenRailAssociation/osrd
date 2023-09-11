import { noop } from 'lodash';
import {
  changeTrain,
  getTrainDetailsForAPI,
} from 'modules/simulationResult/components/simulationResultsHelpers';
import { setFailure } from 'reducers/main';
import i18n from 'i18next';

import { AnyAction, Dispatch, Reducer } from 'redux';
// TODO: Dependency cycle will be removed during the refactoring of store
// eslint-disable-next-line import/no-cycle
import { RootState } from 'reducers';
import { SimulationReport, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ApiError } from 'common/api/emptyApi';
import { SerializedError } from '@reduxjs/toolkit';
import { OsrdSimulationState, SimulationSnapshot } from './types';
import {
  UPDATE_SIMULATION,
  UNDO_SIMULATION,
  REDO_SIMULATION,
  undoSimulation,
  redoSimulation,
  updateSimulation,
} from './actions';

// CONTEXT HELPERS

const simulationEquals = (present: SimulationSnapshot, newPresent: SimulationSnapshot) =>
  JSON.stringify(present) === JSON.stringify(newPresent);

const apiSyncOnDiff = (
  present: SimulationSnapshot,
  nextPresent: SimulationSnapshot,
  dispatch = noop
) => {
  // If there is not mod don't do anything
  if (simulationEquals(present, nextPresent)) return;
  // test missing trains and apply delete api

  for (let i = 0; i < present.trains?.length; i += 1) {
    const presentTrain = present.trains[i];
    const apiDetailsForPresentTrain = JSON.stringify(getTrainDetailsForAPI(presentTrain));
    const { id } = present.trains[i];

    const nextTrain = (nextPresent.trains as SimulationReport[]).find((train) => train.id === id);
    const apiDetailsForNextTrain = nextTrain
      ? JSON.stringify(getTrainDetailsForAPI(nextTrain))
      : undefined;

    // This trains is absent from the future simulation state.
    if (!nextTrain) {
      // Call delete API (await)
      try {
        dispatch(osrdEditoastApi.endpoints.deleteTrainScheduleById.initiate({ id }));
      } catch (deleteTrainScheduleError) {
        dispatch(
          setFailure({
            name: i18n.t(''),
            message:
              `${(deleteTrainScheduleError as ApiError).data.message}` ||
              `${(deleteTrainScheduleError as SerializedError).message}`,
          })
        );
      }
    } else if (
      JSON.stringify(apiDetailsForNextTrain) !== JSON.stringify(apiDetailsForPresentTrain)
    ) {
      // train exists, but is different. Patch this train
      changeTrain(getTrainDetailsForAPI(nextTrain), nextTrain.id)(dispatch);
    }
  }
};

// THUNKS
export const persistentUndoSimulation = () =>
  async function persistentUndoSimulationParts(dispatch: Dispatch, getState: () => RootState) {
    // use getState to check the diff between past and present
    const { present, past } = getState().osrdsimulation.simulation;
    const nextPresent = past[past.length - 1];
    if (nextPresent) apiSyncOnDiff(present, nextPresent, dispatch);

    // do the undo:
    undoSimulation();
  };

export const persistentRedoSimulation = () =>
  async function persistentRedoSimulationParts(dispatch: Dispatch, getState: () => RootState) {
    // use getState to check the diff between next one and present
    const present = getState()?.osrdsimulation.simulation.present;
    const future = getState()?.osrdsimulation.simulation.future;
    const nextPresent = future[0];
    // call the corresponding API
    if (nextPresent) apiSyncOnDiff(present, nextPresent, dispatch);
    // do the undo:
    redoSimulation();
  };

export const persistentUpdateSimulation = (simulation: SimulationSnapshot) =>
  async function persistentUpdateSimulationParts(dispatch: Dispatch, getState: () => RootState) {
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation.present;
    const nextPresent = simulation; // To be the next present

    apiSyncOnDiff(present, nextPresent, dispatch);

    // do the undo:
    updateSimulation(simulation);
  };

const undoable = (simulationReducer: Reducer<SimulationSnapshot, AnyAction>) => {
  // Call the reducer with empty action to populate the initial state
  const initialStateU = {
    past: [],
    present: simulationReducer(undefined, { type: '' }),
    future: [],
  };

  // Return a reducer that handles undo and redo
  return function undoableReducer(state: OsrdSimulationState['simulation'], action: AnyAction) {
    if (!state) state = initialStateU;
    const { past, present, future } = state;

    switch (action.type) {
      case UNDO_SIMULATION: {
        const previous = past[past.length - 1];
        // security: do not return manually to an empty simulation, it should not happen
        if (previous.trains?.length === 0) return state;
        const newPast = past.slice(0, past.length - 1);
        return {
          past: newPast,
          present: previous,
          future: [present, ...future],
        };
      }
      case REDO_SIMULATION: {
        const next = future[0];
        if (next.trains?.length === 0) return state;
        const newFuture = future.slice(1);
        return {
          past: [...past, present],
          present: next,
          future: newFuture,
        };
      }
      default: {
        // Delegate handling the action to the passed reducer
        const newPresent = simulationReducer(present, action);

        // test equality on train
        if (present === newPresent || simulationEquals(present, newPresent)) {
          return state;
        }
        return {
          past: [...past, present],
          present: newPresent,
          future: [],
        };
      }
    }
  };
};

// Reducer
const initialState: SimulationSnapshot = {
  trains: [],
};

function reducer(state: SimulationSnapshot | undefined, action: AnyAction) {
  if (!state) state = initialState;

  switch (action.type) {
    case UPDATE_SIMULATION: {
      return action.simulation;
    }
    default:
      return state;
  }
}

const undoableSimulation = undoable(reducer);

export default undoableSimulation;
