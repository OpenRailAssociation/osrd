import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { UserState } from '.';

export const getUser = (state: RootState) => state.user;

const makeUserSelector = makeSubSelector<UserState>(getUser);

export const getIsLogged = makeUserSelector('isLogged');
export const getToLogin = makeUserSelector('toLogin');
export const getLoginError = makeUserSelector('loginError');
export const getServerError = makeUserSelector('serverError');
export const getUsername = makeUserSelector('username');
export const getLanguage = makeUserSelector('language');
export const getAccessToken = makeUserSelector('accessToken');
export const getAccount = makeUserSelector('account');
