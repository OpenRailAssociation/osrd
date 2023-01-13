import {
  changeTrain,
  getTrainDetailsForAPI,
} from 'applications/operationalStudies/components/TrainList/TrainListHelpers';
import { deleteRequest, get, post } from 'common/requests';
import { setFailure } from 'reducers/main';

import trainNameWithNum from 'applications/operationalStudies/components/AddTrainSchedule/trainNameHelper';
import { trainscheduleURI } from 'applications/operationalStudies/components/Simulation/consts';

export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UNDO_SIMULATION = 'osrdsimu/UNDO_SIMULATION';
export const REDO_SIMULATION = 'osrdsimu/REDO_SIMULATION';

const timetableURI = '/timetable/';

export function updateSimulation(simulation) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}

/**
 * This version of getTimeTable does not erase the simulations trains
 */
export async function progressiveDuplicateTrain(
  timetableID,
  selectedProjection,
  simulationTrains,
  selectedTrain,
  trainDelta,
  dispatch
) {
  const trainDetail = await get(`${trainscheduleURI}${simulationTrains[selectedTrain].id}/`);
  const params = {
    timetable: trainDetail.timetable,
    path: trainDetail.path,
    schedules: [],
  };
  let actualTrainCount = 1;
  const trainName = simulationTrains[selectedTrain]?.name;
  const trainCount = simulationTrains.length;
  const trainStep = 10;
  for (let nb = 1; nb <= trainCount; nb += 1) {
    const newTrainDelta = 60 * trainDelta * nb;
    const newOriginTime = simulationTrains[selectedTrain].base.stops[0].time + newTrainDelta;
    const newTrainName = trainNameWithNum(trainName, actualTrainCount, trainCount);
    params.schedules.push({
      departure_time: newOriginTime,
      initial_speed: trainDetail.initial_speed,
      labels: trainDetail.labels,
      rolling_stock: trainDetail.rolling_stock,
      train_name: newTrainName,
      allowances: trainDetail.allowances,
    });
    actualTrainCount += trainStep;
  }
  await post(`${trainscheduleURI}standalone_simulation/`, params);
  const timetable = await get(`${timetableURI}${timetableID}/`);
  const trainSchedulesIDs = timetable.train_schedules.map((train) => train.id);
  try {
    const simulationLocal = await get(`${trainscheduleURI}results/`, {
      train_ids: trainSchedulesIDs.join(','),
      path: selectedProjection.path,
    });
    simulationLocal.sort((a, b) => a.base.stops[0].time > b.base.stops[0].time);
    dispatch(updateSimulation({ trains: simulationLocal }));
  } catch (e) {
    dispatch(
      setFailure({
        name: 'unableToRetrieveTrainSchedule',
        message: `${e.message} : ${e.response.data.detail}`,
      })
    );
    console.log('ERROR', e);
  }
}

// CONTEXT HELPERS

function simulationEquals(present, newPresent) {
  return JSON.stringify(present) === JSON.stringify(newPresent);
}

function apiSyncOnDiff(present, nextPresent, dispatch = () => {}) {
  // If there is not mod don't do anything
  if (simulationEquals(present, nextPresent)) return;
  // test missing trains and apply delete api

  for (let i = 0; i < present.trains?.length; i += 1) {
    const presentTrain = present.trains[i];
    const apiDetailsForPresentTrain = JSON.stringify(getTrainDetailsForAPI(presentTrain));
    const { id } = present.trains[i];

    const nextTrain = nextPresent.trains.find((train) => train.id === id);
    const apiDetailsForNextTrain = nextTrain
      ? JSON.stringify(getTrainDetailsForAPI(nextTrain))
      : undefined;

    // This trains is absent from the future simulation state.
    if (!nextTrain) {
      // Call delete API (await)
      try {
        deleteRequest(`${trainscheduleURI}${id}/`);
      } catch (e) {
        console.log('ERROR', e);
        dispatch(
          setFailure({
            name: e.name,
            message: e.message,
          })
        );
      }
    } else if (
      JSON.stringify(apiDetailsForNextTrain) !== JSON.stringify(apiDetailsForPresentTrain)
    ) {
      // train exists, but is different. Patch this train
      changeTrain(getTrainDetailsForAPI(nextTrain), nextTrain.id);
    }
  }
}

// THUNKS
export function persistentUndoSimulation() {
  return async function persistentUndoSimulationParts(dispatch, getState) {
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation.present;
    const past = getState()?.osrdsimulation.simulation.past;
    const nextPresent = past[past.length - 1];
    if (nextPresent) apiSyncOnDiff(present, nextPresent);

    // do the undo:
    dispatch({
      type: UNDO_SIMULATION,
    });
  };
}

export function persistentRedoSimulation() {
  return async function persistentRedoSimulationParts(dispatch, getState) {
    // use getState to check the diff between next one and present
    const present = getState()?.osrdsimulation.simulation.present;
    const future = getState()?.osrdsimulation.simulation.future;
    const nextPresent = future[0];
    // call the corresponding API
    if (nextPresent) apiSyncOnDiff(present, nextPresent, dispatch);
    // do the undo:
    dispatch({
      type: REDO_SIMULATION,
    });
  };
}

export function persistentUpdateSimulation(simulation) {
  return async function persistentUpdateSimulationParts(dispatch, getState) {
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation.present;
    const nextPresent = simulation; // To be the next present

    apiSyncOnDiff(present, nextPresent, dispatch, getState);

    // do the undo:
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}

function undoable(simulationReducer) {
  // Call the reducer with empty action to populate the initial state
  const initialStateU = {
    past: [],
    present: simulationReducer(undefined, {}),
    future: [],
  };

  // Return a reducer that handles undo and redo
  return function undoableReducer(state, action) {
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
}

// Reducer
const initialState = {
  trains: [],
};

function reducer(state, action) {
  if (!state) state = initialState;

  switch (action.type) {
    case UPDATE_SIMULATION:
      return action.simulation;
    default:
      return state;
  }
}

const undoableSimulation = undoable(reducer);

export default undoableSimulation;

export function undoSimulation() {
  return (dispatch) => {
    dispatch({
      type: UNDO_SIMULATION,
    });
  };
}

export function redoSimulation() {
  return (dispatch) => {
    dispatch({
      type: REDO_SIMULATION,
    });
  };
}
