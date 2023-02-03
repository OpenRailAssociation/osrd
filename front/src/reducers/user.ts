/* eslint-disable consistent-return */
/* eslint-disable default-case */
import { AnyAction, Dispatch } from 'redux';
import produce from 'immer';
import jwtDecode from 'jwt-decode';

import keycloak from 'keycloak';

// Action Types
export const LOGIN_SUCCESS = 'user/LOGIN_SUCCESS';
export const LOGIN_ERROR = 'user/LOGIN_ERROR';
export const LOGOUT = 'user/LOGOUT';
export const SERVER_ERROR = 'user/SERVER_ERROR';
export const UPDATE_ACCOUNT = 'user/UPDATE_ACCOUNT';

// Reducer
export const initialState: UserState = {
  isLogged: false,
  toLogin: true,
  loginError: false,
  serverError: false,
  username: '',
  language: 'fr',
  accessToken: undefined,
  account: {},
};

export interface UserState {
  isLogged: boolean;
  toLogin: boolean;
  loginError: boolean;
  serverError: boolean;
  username: string;
  language: string;
  accessToken?: string;
  account: Record<string, string>;
}

export default function reducer(inputState: UserState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case LOGIN_SUCCESS:
        draft.isLogged = true;
        draft.toLogin = false;
        draft.accessToken = action.accessToken;
        if (action.username !== undefined) {
          draft.username = action.username;
        }
        return draft;
      case LOGIN_ERROR:
        draft.loginError = action.withErrorMessage;
        draft.toLogin = true;
        return draft;
      case LOGOUT:
        return initialState;
      case SERVER_ERROR:
        draft.serverError = true;
        return draft;
      case UPDATE_ACCOUNT:
        draft.account = action.account;
        return draft;
      default:
        return draft;
    }
  });
}

// Action Creators
function loginSuccess(accessToken: string, username = undefined) {
  return {
    type: LOGIN_SUCCESS,
    accessToken,
    username,
  };
}

function loginError(withErrorMessage = true) {
  return {
    type: LOGIN_ERROR,
    withErrorMessage,
  };
}

function logoutUser() {
  return {
    type: LOGOUT,
  };
}

function serverError() {
  return {
    type: SERVER_ERROR,
  };
}

function updateAccount(account: Record<string, string>) {
  return {
    type: UPDATE_ACCOUNT,
    account,
  };
}

// Functions
export function logout() {
  return (dispatch: Dispatch) => {
    keycloak.logout();
    dispatch(logoutUser());
  };
}

export function refreshToken() {
  return async (dispatch: Dispatch) => {
    try {
      const isUpdated = await keycloak.updateToken(60);
      if (isUpdated) {
        const accessToken = keycloak.getToken();
        localStorage.setItem('access_token', accessToken);
        dispatch(loginSuccess(accessToken));
      }
      setTimeout(() => refreshToken()(dispatch), 60000);
    } catch (e) {
      logout();
      throw e;
    }
  };
}

export function login() {
  return async (dispatch: Dispatch) => {
    try {
      const accessToken = keycloak.getToken();
      const username = keycloak.getUsername();
      localStorage.setItem('access_token', accessToken);
      setTimeout(() => refreshToken()(dispatch), 60000);

      const decoded = jwtDecode(accessToken) as Record<string, string>;
      const account = {
        id: decoded.id,
        username: decoded.preferred_username,
        firstName: decoded.given_name,
        lastName: decoded.family_name,
        email: decoded.email,
      };

      dispatch(updateAccount(account));
      dispatch(loginSuccess(accessToken, username));
      console.info('Connecté');
    } catch (e: any) {
      console.error('Login ERROR', e.response);
      dispatch(loginError());
    }
  };
}

export function attemptLoginOnLaunch() {
  return async (dispatch: Dispatch) => {
    try {
      await keycloak.initKeycloak(() => login()(dispatch));
    } catch (e: any) {
      if (!e.response) {
        // When server error and unreachable no code is send, e.response/status/code are empty
        console.error('Erreur serveur');
        dispatch(serverError());
      } else {
        console.error('Non authentifié :', e.message);
        dispatch(loginError(false));
      }
    }
  };
}
