import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { UserState } from 'reducers/user';

export const getUser = (state: RootState) => state.user;
const makeUserSelector = makeSubSelector<UserState>(getUser);
export const getUserPreferences = makeUserSelector('userPreferences');
const makeUserPreferencesSelector =
  makeSubSelector<UserState['userPreferences']>(getUserPreferences);

export const getIsUserLogged = makeUserSelector('isLogged');
export const getLoginError = makeUserSelector('loginError');
export const getUserSafeWord = makeUserPreferencesSelector('safeWord');
export const getUsername = makeUserSelector('username');
