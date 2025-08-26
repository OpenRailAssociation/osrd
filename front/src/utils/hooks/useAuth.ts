import { useCallback, useEffect } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector } from 'react-redux';

import {
  addTagTypes,
  osrdEditoastApi,
  type SearchResultItemUser,
} from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { setImpersonatedUser, updateAuthzUser } from 'reducers/user';
import { getIsUserLogged, getImpersonatedUser, getUsername } from 'reducers/user/userSelectors';

function useAuth() {
  const dispatch = useDispatch();
  const isUserLogged = useSelector(getIsUserLogged);
  const username = useSelector(getUsername);
  const impersonatedUser = useSelector(getImpersonatedUser);

  const [login, { isLoading: isAuthenticateLoading }] =
    osrdGatewayApi.endpoints.login.useMutation();

  const [logout] = osrdGatewayApi.endpoints.logout.useMutation();

  const { data } = osrdEditoastApi.endpoints.getAuthzMe.useQuery(
    isUserLogged ? undefined : skipToken
  );

  const user = osrdEditoastApi.endpoints.getAuthzMe.useQuery(isUserLogged ? undefined : skipToken);

  useEffect(() => {
    if (!isUserLogged && !isAuthenticateLoading) {
      login();
    }
  }, [isUserLogged]);

  useEffect(() => {
    if (data) {
      dispatch(updateAuthzUser(data ? { userRoles: data.roles, userId: data.id } : undefined));
    }
  }, [isUserLogged, data]);

  /**
   * Function to impersonate the given user, or if undefined, stop the impersonation.
   */
  const impersonate = useCallback((userToImpersonate: SearchResultItemUser | undefined) => {
    dispatch(setImpersonatedUser(userToImpersonate));
    dispatch(osrdEditoastApi.util.invalidateTags(addTagTypes.map((t) => ({ type: t }))));
  }, []);

  return {
    username: user.data?.name ?? username,
    isUserLogged,
    impersonatedUser,
    isLoading: isAuthenticateLoading || !data,
    logout,
    impersonate,
  };
}

export default useAuth;
