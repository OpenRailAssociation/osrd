import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ApiError } from 'common/api/baseGeneratedApis';
import type { Role } from 'common/api/osrdEditoastApi';

export const FEATURE_FLAGS = [
  'linkings',
  'hourlyTimetables',
  'multipleTimetables',
  'unrecognizedWaypoints',
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type UserPreferences = {
  featureFlags: Record<FeatureFlag, boolean>;
  safeWord: string;
};

const defaultFeatureFlags: Record<FeatureFlag, boolean> = {
  linkings: false,
  hourlyTimetables: false,
  multipleTimetables: false,
  unrecognizedWaypoints: false,
};

export type UserState = {
  isLogged: boolean;
  impersonatedUser?: UserInfo;
  loginError?: ApiError;
  userId: number;
  username: string;
  userPreferences: UserPreferences;
  userRoles: Role[];
  account: Record<string, string>;
};

export type UserInfo = {
  groups: {
    id: number;
    name: string;
  }[];
  id: number;
  identities: string[];
  name: string;
  roles: Role[];
};

export const userInitialState: UserState = {
  isLogged: false,
  impersonatedUser: undefined,
  loginError: undefined,
  username: '',
  userPreferences: { safeWord: '', featureFlags: defaultFeatureFlags },
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
    setImpersonatedUser(state, action: PayloadAction<UserInfo | undefined>) {
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
    updateFeatureFlags(state, action: PayloadAction<UserPreferences['featureFlags']>) {
      state.userPreferences.featureFlags = action.payload;
    },
    updateSafeWord(state, action: PayloadAction<string>) {
      state.userPreferences.safeWord = action.payload;
    },
  },
});

export const {
  loginSuccess,
  loginError,
  logoutSuccess,
  setImpersonatedUser,
  updateFeatureFlags,
  updateSafeWord,
  updateAuthzUser,
} = userSlice.actions;

export default userSlice.reducer;
