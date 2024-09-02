import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError } from 'common/api/baseGeneratedApis';

export interface UserState {
  isLogged: boolean;
  loginError?: ApiError;
  username: string;
  userPreferences: { safeWord: string };
  account: Record<string, string>;
  stdcmV2Activated: boolean;
}

export const userInitialState: UserState = {
  isLogged: false,
  loginError: undefined,
  username: '',
  userPreferences: { safeWord: '' },
  account: {},
  stdcmV2Activated: true,
};

export const userSlice = createSlice({
  name: 'user',
  initialState: userInitialState,
  reducers: {
    loginSuccess(
      state,
      action: PayloadAction<{
        username: UserState['username'];
      }>
    ) {
      const { username } = action.payload;
      state.username = username;
      state.isLogged = true;
    },
    loginError(state, action: PayloadAction<ApiError | undefined>) {
      state.isLogged = false;
      state.loginError = action.payload;
    },
    logoutSuccess() {
      return userInitialState;
    },
    updateUserPreferences(state, action: PayloadAction<{ safeWord: string }>) {
      state.userPreferences = action.payload;
    },
    switchStdcmV2Activated(state) {
      state.stdcmV2Activated = !state.stdcmV2Activated;
    },
  },
});

export const {
  loginSuccess,
  loginError,
  logoutSuccess,
  updateUserPreferences,
  switchStdcmV2Activated,
} = userSlice.actions;

export default userSlice.reducer;
