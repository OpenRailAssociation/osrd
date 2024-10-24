import type { BuiltinRole } from 'common/api/osrdEditoastApi';
import { REQUIRED_USER_ROLES_FOR } from 'common/authorization/roleBaseAccessControl';
import type { RootState } from 'reducers';
import type { UserState } from 'reducers/user';
import { makeSubSelector } from 'utils/selectors';

export const getUser = (state: RootState) => state.user;
const makeUserSelector = makeSubSelector<UserState>(getUser);
export const getUserPreferences = makeUserSelector('userPreferences');
export const getStdcmV2Activated = makeUserSelector('stdcmV2Activated');
const makeUserPreferencesSelector =
  makeSubSelector<UserState['userPreferences']>(getUserPreferences);
export const getIsUserLogged = makeUserSelector('isLogged');
export const getLoginError = makeUserSelector('loginError');
export const getUserSafeWord = makeUserPreferencesSelector('safeWord');
export const getUsername = makeUserSelector('username');
export const getUserRoles = makeUserSelector('userRoles');
export const getIsSuperUser = (state: RootState) => getUserRoles(state).includes('Superuser');

const makeUserHasAllRequiredRolesSelector =
  (requiredRoles: BuiltinRole[]) => (state: RootState) => {
    const userRoles = getUserRoles(state);
    return requiredRoles.every((role) => userRoles.includes(role));
  };
export const getIsStdcmProfile = makeUserHasAllRequiredRolesSelector(
  REQUIRED_USER_ROLES_FOR.USER_PROFILE.STDCM
);
export const getIsOperationalStudyProfile = makeUserHasAllRequiredRolesSelector(
  REQUIRED_USER_ROLES_FOR.USER_PROFILE.OPERATIONAL_STUDIES
);
