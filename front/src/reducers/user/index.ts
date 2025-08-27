import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError } from 'common/api/baseGeneratedApis';
import type { Role, SearchResultItemUser } from 'common/api/osrdEditoastApi';

export type UserState = {
  isLogged: boolean;
  impersonatedUser?: SearchResultItemUser;
  loginError?: ApiError;
  userId: number;
  username: string;
  userPreferences: { safeWord: string };
  userRoles: Role[];
  account: Record<string, string>;
};

export const userInitialState: UserState = {
  isLogged: false,
  impersonatedUser: undefined,
  loginError: undefined,
  username: '',
  userPreferences: { safeWord: '' },
  userId: -1,
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
    setImpersonatedUser(state, action: PayloadAction<SearchResultItemUser | undefined>) {
      state.impersonatedUser = action.payload;
    },
    updateAuthzUser(
      state,
      action: PayloadAction<{ userRoles: Role[]; userId: number } | undefined>
    ) {
      if (action.payload) {
        const { userRoles, userId } = action.payload;
        state.userRoles = userRoles;
        state.userId = userId;
      } else {
        state.userRoles = [];
        state.userId = -1;
      }
    },
    updateUserPreferences(state, action: PayloadAction<{ safeWord: string }>) {
      state.userPreferences = action.payload;
    },
  },
});

export const {
  loginSuccess,
  loginError,
  logoutSuccess,
  setImpersonatedUser,
  updateUserPreferences,
  updateAuthzUser,
} = userSlice.actions;

export default userSlice.reducer;
