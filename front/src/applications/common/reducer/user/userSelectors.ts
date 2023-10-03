import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { UserState } from 'applications/common/reducer/user/userSlice';

export const getUser = (state: RootState) => state.user;

export const getIsUserLogged = makeSubSelector<UserState, 'isLogged'>(getUser, 'isLogged');
export const getUsername = makeSubSelector<UserState, 'username'>(getUser, 'username');
export const getAccessToken = makeSubSelector<UserState, 'accessToken'>(getUser, 'accessToken');
export const getUserAccount = makeSubSelector<UserState, 'account'>(getUser, 'account');
export const getLoginError = makeSubSelector<UserState, 'loginError'>(getUser, 'loginError');
export const getServerError = makeSubSelector<UserState, 'serverError'>(getUser, 'serverError');
export const getToLogin = makeSubSelector<UserState, 'toLogin'>(getUser, 'toLogin');
