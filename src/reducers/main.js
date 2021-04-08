/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const TOGGLE_FULLSCREEN = 'main/TOGGLE_FULLSCREEN';

// Reducer
export const initialState = {
  fullscreen: false,
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case TOGGLE_FULLSCREEN:
        draft.fullscreen = !state.fullscreen;
        break;
    }
  });
}

// Functions
export function toggleFullscreen() {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_FULLSCREEN,
    });
  };
}
