import produce from 'immer';

export const UPDATE_SIMULATION = 'osrdsimu/UPDATE_SIMULATION';

// Reducer
export const initialState = {
  trains: [],
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_SIMULATION:
        draft.trains = action.simulation.trains;
        break;
    }
  });
}

export function updateSimulation(simulation) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SIMULATION,
      simulation,
    });
  };
}
