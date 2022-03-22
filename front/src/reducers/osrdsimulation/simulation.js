import produce from 'immer';

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
      case 'UNDO_SIMULATION':
        const previous = past[past.length - 1]
        const newPast = past.slice(0, past.length - 1)
        return {
          past: newPast,
          present: previous,
          future: [present, ...future]
        }
      case 'REDO_SIMULATION':
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

export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';

// Reducer
const initialState = {
  trains: [],
};

function reducer(state = initialState, action) {
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
