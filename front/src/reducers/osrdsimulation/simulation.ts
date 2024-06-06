import i18n from 'i18next';
import type { AnyAction, Reducer } from 'redux';

import { STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import {
  type SimulationReport,
  type TrainSchedule,
  type TrainSchedulePatch,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import type { AppDispatch, GetState } from 'store';
import { castErrorToFailure } from 'utils/error';

import {
  UPDATE_SIMULATION,
  UNDO_SIMULATION,
  REDO_SIMULATION,
  undoSimulation,
  redoSimulation,
  updateSimulation,
} from './actions';
import type { OsrdSimulationState, SimulationSnapshot, Train } from './types';

/**
 * Premare the params to override the trains details and save them
 * @param {object} simulationTrain
 * @returns
 */
export const getTrainDetailsForAPI = (
  simulationTrain: SimulationReport | Train
): Partial<TrainSchedule> => ({
  id: simulationTrain.id,
  departure_time: simulationTrain.base.stops[0].time,
  train_name: simulationTrain.name,
});
// Nedded to load the namespace for i18n
i18n.loadNamespaces('operationalStudies/manageTrainSchedule');

/**
 * Use the trainScheduleAPI to update train details on a specific computation
 *
 * @export
 * @param {object} details
 * @param {int} id
 */
export const changeTrain =
  (details: Partial<TrainSchedule>, id: number) => async (dispatch: AppDispatch) => {
    const {
      data: trainDetails,
      isError: isGetTrainDetailsError,
      error: getTrainDetailsError,
      isSuccess: isGetTrainDetailsSuccess,
    } = await dispatch(osrdEditoastApi.endpoints.getTrainScheduleById.initiate({ id }));
    if (isGetTrainDetailsSuccess) {
      // TODO: add the other information of the trainSchedule (allowances...)
      const trainSchedule: TrainSchedulePatch = {
        id,
        departure_time: details.departure_time || trainDetails?.departure_time,
        initial_speed: details.initial_speed || trainDetails?.initial_speed,
        labels: details.labels || trainDetails?.labels,
        path_id: details.path_id || trainDetails?.path_id,
        rolling_stock_id: details.rolling_stock_id || trainDetails?.rolling_stock_id,
        train_name: details.train_name || trainDetails?.train_name,
      };
      const response = await dispatch(
        osrdEditoastApi.endpoints.patchTrainSchedule.initiate({ body: [trainSchedule] })
      );
      if ('error' in response) {
        dispatch(
          setFailure(
            castErrorToFailure(response.error, {
              name: i18n.t(
                'operationalStudies/manageTrainSchedule:errorMessages.unableToPatchTrain'
              ),
            })
          )
        );
      }
    } else if (isGetTrainDetailsError && getTrainDetailsError) {
      dispatch(
        setFailure(
          castErrorToFailure(getTrainDetailsError, {
            name: i18n.t(
              'operationalStudies/manageTrainSchedule:errorMessages.unableToRetrieveTrain'
            ),
          })
        )
      );
    }
  };

// CONTEXT HELPERS

const simulationEquals = (present: SimulationSnapshot, newPresent: SimulationSnapshot) =>
  JSON.stringify(present) === JSON.stringify(newPresent);

const apiSyncOnDiff = (
  present: SimulationSnapshot,
  nextPresent: SimulationSnapshot,
  dispatch: AppDispatch
) => {
  // if there is no modification, don't do anything
  if (simulationEquals(present, nextPresent)) return;

  present.trains.forEach((presentTrain) => {
    const { id } = presentTrain;

    // if train is stdcm, it is not persisted in the backend
    // so it should not be fetched/updated in the backend too
    if (id === STDCM_TRAIN_ID) return;

    const apiDetailsForPresentTrain = JSON.stringify(getTrainDetailsForAPI(presentTrain));

    const nextTrain = (nextPresent.trains as SimulationReport[]).find((train) => train.id === id);
    const apiDetailsForNextTrain = nextTrain
      ? JSON.stringify(getTrainDetailsForAPI(nextTrain))
      : undefined;

    // the train is absent from the future simulation state, so remove it
    if (!nextTrain) {
      try {
        dispatch(osrdEditoastApi.endpoints.deleteTrainScheduleById.initiate({ id }));
      } catch (deleteTrainScheduleError) {
        dispatch(setFailure(castErrorToFailure(deleteTrainScheduleError)));
      }
    } else if (
      JSON.stringify(apiDetailsForNextTrain) !== JSON.stringify(apiDetailsForPresentTrain)
    ) {
      // the train exists but has been modified. Patch this train
      changeTrain(getTrainDetailsForAPI(nextTrain), nextTrain.id)(dispatch);
    }
  });
};

// THUNKS
export const persistentUndoSimulation = () =>
  async function persistentUndoSimulationParts(dispatch: AppDispatch, getState: GetState) {
    // use getState to check the diff between past and present
    const { present, past } = getState().osrdsimulation.simulation;
    const nextPresent = past[past.length - 1];
    if (nextPresent) apiSyncOnDiff(present, nextPresent, dispatch);

    // do the undo:
    undoSimulation();
  };

export const persistentRedoSimulation = () =>
  async function persistentRedoSimulationParts(dispatch: AppDispatch, getState: GetState) {
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
  async function persistentUpdateSimulationParts(dispatch: AppDispatch, getState: GetState) {
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation.present;
    const nextPresent = simulation; // To be the next present

    apiSyncOnDiff(present, nextPresent, dispatch);

    // do the undo:
    dispatch(updateSimulation(simulation));
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
