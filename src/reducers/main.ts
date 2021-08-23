/* eslint-disable default-case */
import produce from 'immer';
import { ThunkAction, Notification } from '../types';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const TOGGLE_DARKMODE = 'main/TOGGLE_DARKMODE';
type ActionToggleDarkmode = { type: typeof TOGGLE_DARKMODE };
export function toggleDarkmode(): ThunkAction<ActionToggleDarkmode> {
  return (dispatch: any) => {
    dispatch({
      type: TOGGLE_DARKMODE,
    });
  };
}

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
type ActionSuccess = { type: typeof ACTION_SUCCESS; message: Notification | null };
export function setSuccess(msg?: Notification): ThunkAction<ActionSuccess> {
  return (dispatch) => {
    dispatch({
      type: ACTION_SUCCESS,
      message: msg || null,
    });
  };
}

export const ACTION_FAILURE = 'main/ACTION_FAILURE';
type ActionFailure = { type: typeof ACTION_FAILURE; error: Error };
export function setFailure(e: Error): ThunkAction<ActionFailure> {
  return (dispatch) => {
    dispatch({
      type: ACTION_FAILURE,
      error: e,
    });
  };
}

export const ACTION_NOTIFICATION_ADD = 'main/ACTION_NOTIFICATION_ADD';
type ActionNotificationAdd = { type: typeof ACTION_NOTIFICATION_ADD; notification: Notification };
export function addNotification(n: Notification): ThunkAction<ActionNotificationAdd> {
  return (dispatch) => {
    dispatch({
      type: ACTION_NOTIFICATION_ADD,
      notification: { date: new Date(), ...n },
    });
  };
}

export const ACTION_NOTIFICATION_DELETE = 'main/ACTION_NOTIFICATION_DELETE';
type ActionNotificationDelete = {
  type: typeof ACTION_NOTIFICATION_DELETE;
  notification: Notification;
};
export function deleteNotification(n: Notification): ThunkAction<ActionNotificationDelete> {
  return (dispatch) => {
    dispatch({
      type: ACTION_NOTIFICATION_DELETE,
      notification: n,
    });
  };
}

type Actions =
  | ActionFailure
  | ActionSuccess
  | ActionLoading
  | ActionToggleDarkmode
  | ActionToggleFullscreen
  | ActionNotificationAdd
  | ActionNotificationDelete;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface MainState {
  darkmode: boolean;
  fullscreen: boolean;
  loading: number;
  notifications: Array<Notification>;
}
export const initialState: MainState = {
  darkmode: false,
  fullscreen: false,
  // Number of running task
  loading: 0,
  // errors
  notifications: [],
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(state = initialState, action: Actions) {
  return produce(state, (draft) => {
    switch (action.type) {
      case TOGGLE_DARKMODE:
        draft.darkmode = !state.darkmode;
        break;
      case TOGGLE_FULLSCREEN:
        draft.fullscreen = !state.fullscreen;
        break;
      case ACTION_LOADING:
        draft.loading = state.loading + 1;
        break;
      case ACTION_SUCCESS:
        draft.loading = state.loading > 0 ? state.loading - 1 : 0;
        if (action.message) {
          draft.notifications.push({
            type: action.message.type || 'success',
            title: action.message.title,
            text: action.message.text,
            date: action.message.date || new Date(),
          });
        }
        break;
      case ACTION_FAILURE:
        draft.loading = state.loading > 0 ? state.loading - 1 : 0;
        draft.notifications.push({
          type: 'error',
          title: action.error.name,
          text: action.error.message,
          date: new Date(),
        });
        break;
      case ACTION_NOTIFICATION_ADD:
        draft.notifications.push({ date: new Date(), ...action.notification });
        break;
      case ACTION_NOTIFICATION_DELETE:
        draft.notifications = draft.notifications.filter(
          (n: Notification) =>
            !(
              n.date === action.notification.date &&
              n.text === action.notification.text &&
              n.type === action.notification.type &&
              n.title === action.notification.title
            ),
        );
        break;
    }
  });
}
