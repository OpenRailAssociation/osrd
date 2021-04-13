/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const TOGGLE_FULLSCREEN = 'main/TOGGLE_FULLSCREEN';
export const ACTION_LOADING = 'main/ACTION_LOADING';
export const ACTION_SUCCESS = 'main/ACTION_SUCCESS';
export const ACTION_FAILURE = 'main/ACTION_FAILURE';

// Reducer
export const initialState = {
  fullscreen: false,
  // Number of running task
  loading: 0,
  // errors
  error: [],
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case TOGGLE_FULLSCREEN:
        draft.fullscreen = !state.fullscreen;
        break;
      case ACTION_LOADING:
        draft.loading = state.loading + 1;
        break;
      case ACTION_SUCCESS:
        draft.loading = state.loading - 1;
        break;
      case ACTION_FAILURE:
        draft.loading = state.loading - 1;
        draft.error.push(action.error);
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

/**
 * Set the loading state
 */
export function setLoading() {
  return (dispatch) => {
    dispatch({
      type: ACTION_LOADING,
    });
  };
}

/**
 * Set the success of a task
 * by decrementing the loading state
 */
export function setSuccess() {
  return (dispatch) => {
    dispatch({
      type: ACTION_SUCCESS,
    });
  };
}

/**
 * Set the failure of a task
 * by pushing the error in the state and decrementing the loading.
 *
 * @param {Error} e The error of the failure
 */
export function setFailure(e) {
  return (dispatch) => {
    console.log(e);
    dispatch({
      type: ACTION_FAILURE,
      error: e,
    });
  };
}
