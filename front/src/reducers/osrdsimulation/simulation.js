export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UNDO_SIMULATION = 'osrdsimu/UNDO_SIMULATION';
export const REDO_SIMULATION = 'osrdsimu/REDO_SIMULATION';

import { changeTrain, getTrainDetailsForAPI } from "applications/osrd/components/TrainList/TrainListHelpers";
import { setFailure, setSuccess } from 'reducers/main.ts';

import { deleteRequest } from 'common/requests';
import { get } from 'common/requests';
import { trainscheduleURI } from 'applications/osrd/views/OSRDSimulation/OSRDSimulation'

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
 export async function progressiveGetTimetable(timetableID, selectedProjection, dispatch) {
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
        name: t('simulation:errorMessages.unableToRetrieveTrainSchedule'),
        message: `${e.message} : ${e.response.data.detail}`,
      })
    );
    console.log('ERROR', e);
  }
}

// CONTEXT HELPERS
function simulationTrainsEquals(a, b) {
  return Array.isArray(a?.trains) &&
      Array.isArray(b?.trains) &&
      a.trains.length === b.trains.length &&
      a.trains.every((val, index) => val === b.trains[index]);
}

function simulationEquals(present, newPresent) {
  return JSON.stringify(present) === JSON.stringify(newPresent)
}

function apiSyncOnDiff(present, nextPresent, dispatch = () => {}) {
  // If there is not mod don't do anything
  console.log("Compare next Present and Present")
  if (simulationEquals(present, nextPresent)) return;
  console.log("Next and present simulation not equals, diff computation ops", present)
  // test missing trains and apply delete api

  for (let i = 0; i < present.trains?.length; i += 1) {
    const presentTrain = present.trains[i];
    const apiDetailsForPresentTrain = JSON.stringify(getTrainDetailsForAPI(presentTrain));
    const { id } = present.trains[i];


    const nextTrain = nextPresent.trains.find((train) => train.id === id);
    const apiDetailsForNextTrain = nextTrain
      ? JSON.stringify(getTrainDetailsForAPI(nextTrain)) : undefined;
    console.log(apiDetailsForPresentTrain);
    console.log(apiDetailsForNextTrain);

    // This trains is absent from the future simulation state.
    if (!nextTrain) {
    // Call delete API (await)
      try {
        deleteRequest(`${trainscheduleURI}${id}/`);
      } catch (e) {
        console.log('ERROR', e);
        dispatch(setFailure({
          name: e.name,
          message: e.message,
        }));
      }
    } else if (
      JSON.stringify(apiDetailsForNextTrain) !== JSON.stringify(apiDetailsForPresentTrain)
    ) {
      // train exists, but is different. Patch this train
      console.log("CALL Patch API through Thunk")
      changeTrain(getTrainDetailsForAPI(nextTrain), nextTrain.id);
    }
  }

  // test new trains and apply post api
  for (let i = 0; i < nextPresent.trains; i += 1) {
    const id = nextPresent.trains[i];
    if (!present.trains.find((train) => train.id === id)) {
      // Call standalone api
      progressiveGetTimetable()
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
  }
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
  }
}

export function persistentUpdateSimulation(simulation) {
  return async function persistentUpdateSimulationParts(dispatch, getState) {
    console.log("Get state in Persisted Simulation", getState()?.osrdsimulation.simulation);
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation.present;
    const nextPresent = simulation; // To be the next present


    apiSyncOnDiff(present, nextPresent)
    // call the corresponding API

    // do the undo:
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  }
}


function undoable(simulationReducer) {
  // Call the reducer with empty action to populate the initial state
  const initialStateU = {
    past: [],
    present: simulationReducer(undefined, {}),
    future: []
  }

  // Return a reducer that handles undo and redo
  return function (state = initialStateU, action) {
    const { past, present, future } = state

    switch (action.type) {
      case UNDO_SIMULATION:
        const previous = past[past.length - 1]
        // security: do not return manually to an empty simulation, it should not happen
        if(previous.trains?.length === 0) return state
        const newPast = past.slice(0, past.length - 1)
        return {
          past: newPast,
          present: previous,
          future: [present, ...future]
        }
      case REDO_SIMULATION:
        const next = future[0]
        if(next.trains?.length === 0) return state
        const newFuture = future.slice(1)
        return {
          past: [...past, present],
          present: next,
          future: newFuture
        }
      default:

        // Delegate handling the action to the passed reducer
        const newPresent = simulationReducer(present, action)

        // test equality on train
        if (present === newPresent || simulationEquals(present, newPresent)) {
          return state;
        }
        return {
          past: [...past, present],
          present: newPresent,
          future: []
        }
    }
  }
}

// Reducer
const initialState = {
  trains: [],
};

function reducer(state = { trains: []}, action) {
  // eslint-disable-next-line default-case

  switch (action.type) {
    case UPDATE_SIMULATION:
      return action.simulation;
    default:
      return state;
  }
}

const undoableSimulation = undoable(reducer)

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
