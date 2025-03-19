import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { osrdEditoastApi, type SearchResultItemUser } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { setUserRoles } from 'reducers/user';
import { getIsUserLogged, getImpersonatedUser, getUsername } from 'reducers/user/userSelectors';

type AuthHookData = {
  username?: string;
  isUserLogged: boolean;
  impersonatedUser?: SearchResultItemUser;
  isLoading: boolean;
  logout: () => void;
};

function useAuth(): AuthHookData {
  const isUserLogged = useSelector(getIsUserLogged);
  const username = useSelector(getUsername);
  const impersonatedUser = useSelector(getImpersonatedUser);
  const dispatch = useDispatch();

  const [login, { isLoading: isAuthenticateLoading }] =
    osrdGatewayApi.endpoints.login.useMutation();

  const [logout] = osrdGatewayApi.endpoints.logout.useMutation();

  const { data } = osrdEditoastApi.endpoints.getAuthzMe.useQuery(undefined, {
    skip: !isUserLogged,
  });
  const user = osrdEditoastApi.endpoints.getAuthzMe.useQuery(undefined, {
    skip: !isUserLogged,
  });

  useEffect(() => {
    if (!isUserLogged && !isAuthenticateLoading) {
      login();
    }
  }, [isUserLogged]);

  useEffect(() => {
    if (data) {
      dispatch(setUserRoles(data?.roles));
    }
  }, [isUserLogged, data]);

  return {
    username: user.data?.name ?? username,
    isUserLogged,
    impersonatedUser,
    isLoading: isAuthenticateLoading || !data,
    logout,
  };
}

export default useAuth;
