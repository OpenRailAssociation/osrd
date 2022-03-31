export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UNDO_SIMULATION = 'osrdsimu/UNDO_SIMULATION';
export const REDO_SIMULATION = 'osrdsimu/REDO_SIMULATION';

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

function apiSyncOnDiff(present, newPresent) {
  // If there is not mod don't do anything
  if (simulationEquals(present, newPresent)) return;
  // test missing trains and apply delete api

  for (let i = 0; i < present.trains; i += 1) {
    const id = present.trains[i];
    if (!newPresent.trains.find((train) => train.id === id)) {
     // Call delete API

    }
    // Test equality on each train
     // if trains are same by Id but content not the same, update the new One

    else if (false) {

    }
  }

  // test new trains and apply post api
  for (let i = 0; i < newPresent.trains; i += 1) {
    const id = newPresent.trains[i];
    if (!present.trains.find((train) => train.id === id)) {
     // Call post API
    }
  }

}


// THUNKS
function persistentUndoSimulation() {
  return async function persistentUndoSimulationParts(dispatch, getState) {
    // use getState to check the diff between past and present
    // call the corresponding API

    // do the undo:
    dispatch({
      type: UNDO_SIMULATION,
    });
  }
}

function persistentRedoSimulation() {
  return async function persistentRedoSimulationParts(dispatch, getState) {
    // use getState to check the diff between next one and present
    // call the corresponding API

    // do the undo:
    dispatch({
      type: REDO_SIMULATION,
    });
  }
}

export function persistentUpdateSimulation(simulation) {
  return async function persistentUpdateSimulationParts(dispatch, getState) {
    console.log("Get state in Persisted Simulation", getState());
    // use getState to check the diff between past and present
    const present = getState()?.osrdsimulation.simulation;
    const newPresent = simulation;

    apiSyncOnDiff(present, newPresent)
    // call the corresponding API
console.log(simulation)
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

export function updateSimulation(simulation) {

  return (dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}

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
