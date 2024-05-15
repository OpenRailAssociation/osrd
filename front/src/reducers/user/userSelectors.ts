import type { RootState } from 'reducers';
import type { UserState } from 'reducers/user';
import { makeSubSelector } from 'utils/selectors';

export const getUser = (state: RootState) => state.user;
const makeUserSelector = makeSubSelector<UserState>(getUser);
export const getUserPreferences = makeUserSelector('userPreferences');
export const getTrainScheduleV2Activated = makeUserSelector('trainScheduleV2Activated');
export const getStdcmV2Activated = makeUserSelector('stdcmV2Activated');
const makeUserPreferencesSelector =
  makeSubSelector<UserState['userPreferences']>(getUserPreferences);

export const getIsUserLogged = makeUserSelector('isLogged');
export const getLoginError = makeUserSelector('loginError');
export const getUserSafeWord = makeUserPreferencesSelector('safeWord');
export const getUsername = makeUserSelector('username');
