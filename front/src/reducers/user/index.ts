import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError } from 'common/api/baseGeneratedApis';
import type { Role } from 'common/api/osrdEditoastApi';

export interface UserState {
  isLogged: boolean;
  loginError?: ApiError;
  username: string;
  // TODO PACEDTRAIN: Remove pacedTrain after development pacedTrain feature
  userPreferences: { safeWord: string; showPacedTrains?: boolean };
  userRoles: Role[];
  account: Record<string, string>;
}

export const userInitialState: UserState = {
  isLogged: false,
  loginError: undefined,
  username: '',
  // TODO PACEDTRAIN: Remove pacedTrain after development pacedTrain feature
  userPreferences: { safeWord: '', showPacedTrains: false },
  userRoles: [],
  account: {},
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
    setUserRoles(state, action: PayloadAction<Role[] | undefined>) {
      state.userRoles = action.payload || [];
    },
    updateUserPreferences(
      state,
      // TODO PACEDTRAIN: Remove pacedTrain after development pacedTrain feature
      action: PayloadAction<{ safeWord: string; showPacedTrains?: boolean }>
    ) {
      state.userPreferences = action.payload;
    },
  },
});

export const { loginSuccess, loginError, logoutSuccess, setUserRoles, updateUserPreferences } =
  userSlice.actions;

export default userSlice.reducer;
