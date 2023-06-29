/* eslint-disable default-case */
import produce from 'immer';
import { ThunkAction, Notification } from '../types';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const TOGGLE_DARKMODE = 'main/TOGGLE_DARKMODE';
type ActionToggleDarkmode = { type: typeof TOGGLE_DARKMODE };
export function toggleDarkmode(): ThunkAction<ActionToggleDarkmode> {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_DARKMODE,
    });
  };
}

export const TOGGLE_FULLSCREEN = 'main/TOGGLE_FULLSCREEN';
type ActionToggleFullscreen = { type: typeof TOGGLE_FULLSCREEN };
export function toggleFullscreen(): ThunkAction<ActionToggleFullscreen> {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_FULLSCREEN,
    });
  };
}

export const TOGGLE_MOTRICE_RELATED = 'main/TOGGLE_MOTRICE_RELATED';
type ActionToggleMotriceRelated = { type: typeof TOGGLE_MOTRICE_RELATED };
export function toggleMotriceRelated(): ThunkAction<ActionToggleMotriceRelated> {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_MOTRICE_RELATED,
    });
  };
}

export const ACTION_LOADING = 'main/ACTION_LOADING';
type ActionLoading = { type: typeof ACTION_LOADING };
export function setLoading(): ThunkAction<ActionLoading> {
  return (dispatch) => {
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

export const ACTION_WARNING = 'main/ACTION_WARNING';
export type ActionWarning = { type: typeof ACTION_WARNING; message: Notification | null };
export function setWarning(msg?: Notification): ThunkAction<ActionWarning> {
  return (dispatch) => {
    dispatch({
      type: ACTION_WARNING,
      message: msg || null,
    });
  };
}

export const ACTION_FAILURE = 'main/ACTION_FAILURE';
export type ActionFailure = { type: typeof ACTION_FAILURE; error: Error };
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

export const UPDATE_LAST_INTERFACE_VERSION = 'main/UPDATE_LAST_INTERFACE_VERSION';
type ActionSetLastInterfaceVersion = {
  type: typeof UPDATE_LAST_INTERFACE_VERSION;
  lastInterfaceVersion: string;
};
export function updateLastInterfaceVersion(
  lastInterfaceVersion: string
): ThunkAction<ActionSetLastInterfaceVersion> {
  return (dispatch) => {
    dispatch({
      type: UPDATE_LAST_INTERFACE_VERSION,
      lastInterfaceVersion,
    });
  };
}

export const UPDATE_SAFE_WORD = 'main/UPDATE_SAFE_WORD';
type ActionSetSafeWord = {
  type: typeof UPDATE_SAFE_WORD;
  safeWord: string;
};
export function updateSafeWord(safeWord: string): ThunkAction<ActionSetSafeWord> {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SAFE_WORD,
      safeWord,
    });
  };
}

export type MainActions =
  | ActionFailure
  | ActionSuccess
  | ActionWarning
  | ActionLoading
  | ActionToggleDarkmode
  | ActionToggleFullscreen
  | ActionToggleMotriceRelated
  | ActionNotificationAdd
  | ActionNotificationDelete
  | ActionSetLastInterfaceVersion
  | ActionSetSafeWord;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface MainState {
  darkmode: boolean;
  fullscreen: boolean;
  motriceRelated: boolean;
  loading: number;
  notifications: Array<Notification>;
  lastInterfaceVersion: string;
  safeWord: string;
}
export const initialState: MainState = {
  darkmode: false,
  fullscreen: false,
  motriceRelated: false,
  // Number of running task
  loading: 0,
  // errors
  notifications: [],
  lastInterfaceVersion: '',
  safeWord: '',
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(inputState: MainState | undefined, action: MainActions) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case TOGGLE_DARKMODE:
        draft.darkmode = !state.darkmode;
        break;
      case TOGGLE_FULLSCREEN:
        draft.fullscreen = !state.fullscreen;
        break;
      case TOGGLE_MOTRICE_RELATED:
        draft.motriceRelated = !state.motriceRelated;
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
      case ACTION_WARNING:
        draft.loading = state.loading > 0 ? state.loading - 1 : 0;
        if (action.message) {
          draft.notifications.push({
            type: action.message.type || 'warning',
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
            )
        );
        break;
      case UPDATE_LAST_INTERFACE_VERSION:
        draft.lastInterfaceVersion = action.lastInterfaceVersion;
        break;
      case UPDATE_SAFE_WORD:
        draft.safeWord = action.safeWord;
        break;
    }
  });
}
