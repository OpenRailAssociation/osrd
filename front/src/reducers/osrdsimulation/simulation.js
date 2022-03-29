export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';
export const UNDO_SIMULATION = 'osrdsimu/UNDO_SIMULATION';
export const REDO_SIMULATION = 'osrdsimu/REDO_SIMULATION';

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

        if (present === newPresent) {
          return state
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
