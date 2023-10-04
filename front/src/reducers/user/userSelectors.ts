import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { UserState } from 'reducers/user';

export const getUser = (state: RootState) => state.user;
const makeUserSelector = makeSubSelector<UserState>(getUser);

export const getIsUserLogged = makeUserSelector('isLogged');
export const getUsername = makeUserSelector('username');
export const getAccessToken = makeUserSelector('accessToken');
export const getUserAccount = makeUserSelector('account');
export const getLoginError = makeUserSelector('loginError');
export const getServerError = makeUserSelector('serverError');
export const getToLogin = makeUserSelector('toLogin');
export const getUserPreferences = makeUserSelector('userPreferences');
