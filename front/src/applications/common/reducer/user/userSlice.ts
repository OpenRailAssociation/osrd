import { createSlice, Dispatch, PayloadAction } from '@reduxjs/toolkit';
import jwtDecode from 'jwt-decode';

import keycloak from 'keycloak';

export interface UserState {
  isLogged: boolean;
  toLogin: boolean;
  loginError: boolean;
  serverError: boolean;
  username: string;
  accessToken?: string;
  account: Record<string, string>;
}

export const userInitialState: UserState = {
  isLogged: false,
  toLogin: true,
  loginError: false,
  serverError: false,
  username: '',
  accessToken: undefined,
  account: {},
};

const userSlice = createSlice({
  name: 'user',
  initialState: userInitialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ accessToken: string; username?: string }>) {
      state.isLogged = true;
      state.toLogin = false;
      state.accessToken = action.payload.accessToken;
      if (action.payload.username !== undefined) {
        state.username = action.payload.username;
      }
    },
    loginError(state, action: PayloadAction<boolean>) {
      state.loginError = action.payload;
      state.toLogin = true;
    },
    logoutUser() {
      return userInitialState;
    },
    serverError(state) {
      state.serverError = true;
    },
    updateAccount(state, action: PayloadAction<Record<string, string>>) {
      state.account = action.payload;
    },
  },
});

export const { loginSuccess, loginError, logoutUser, serverError, updateAccount } =
  userSlice.actions;

export default userSlice.reducer;

// Thunks
export const logout = () => async (dispatch: Dispatch) => {
  keycloak.logout();
  dispatch(logoutUser());
};

export const refreshToken = () => async (dispatch: Dispatch) => {
  try {
    const isUpdated = await keycloak.updateToken(60);
    if (isUpdated) {
      const accessToken = keycloak.getToken();
      localStorage.setItem('access_token', accessToken);
      dispatch(loginSuccess({ accessToken }));
    }
    setTimeout(() => refreshToken()(dispatch), 60000);
  } catch (e) {
    console.error('Refresh token ERROR', (e as { response?: unknown }).response);
    logout();
  }
};

export const login = () => async (dispatch: Dispatch) => {
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
    dispatch(loginSuccess({ accessToken, username }));
    console.info('Connecté');
  } catch (e: unknown) {
    console.error('Login ERROR', (e as { response?: unknown }).response);
    dispatch(loginError(true));
  }
};

export const attemptLoginOnLaunch = () => async (dispatch: Dispatch) => {
  try {
    await keycloak.initKeycloak(() => login()(dispatch));
  } catch (e) {
    if (!(e as { response?: unknown }).response) {
      // When server error and unreachable no code is sent, e.response/status/code are empty
      console.error('Init keycloak ERROR', (e as { response?: unknown }).response);
      dispatch(serverError());
    } else {
      console.error('Non authentifié :', (e as Error).message);
      dispatch(loginError(false));
    }
  }
};
