/* eslint-disable default-case */
import produce from 'immer';
import { ThunkAction } from '../types';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const TOGGLE_FULLSCREEN = 'main/TOGGLE_FULLSCREEN';
type ActionToggleFullscreen = { type: typeof TOGGLE_FULLSCREEN };
export function toggleFullscreen(): ThunkAction<ActionToggleFullscreen> {
  return (dispatch: any) => {
    dispatch({
      type: TOGGLE_FULLSCREEN,
    });
  };
}

export const ACTION_LOADING = 'main/ACTION_LOADING';
type ActionLoading = { type: typeof ACTION_LOADING };
export function setLoading(): ThunkAction<ActionLoading> {
  return (dispatch: any) => {
    dispatch({
      type: ACTION_LOADING,
    });
  };
}

export const ACTION_SUCCESS = 'main/ACTION_SUCCESS';
type ActionSuccess = { type: typeof ACTION_SUCCESS };
export function setSuccess(): ThunkAction<ActionSuccess> {
  return (dispatch: any) => {
    dispatch({
      type: ACTION_SUCCESS,
    });
  };
}

export const ACTION_FAILURE = 'main/ACTION_FAILURE';
type ActionFailure = { type: typeof ACTION_FAILURE; error: Error };
export function setFailure(e: Error): ThunkAction<ActionFailure> {
  return (dispatch: any) => {
    dispatch({
      type: ACTION_FAILURE,
      error: e,
    });
  };
}

type Actions = ActionFailure | ActionSuccess | ActionLoading | ActionToggleFullscreen;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface MainState {
  fullscreen: boolean;
  loading: number;
  error: Array<Error>;
}
export const initialState: MainState = {
  fullscreen: false,
  // Number of running task
  loading: 0,
  // errors
  error: [],
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(state = initialState, action: Actions) {
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
