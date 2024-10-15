import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { setUserRoles } from 'reducers/user';
import { getIsUserLogged, getUsername } from 'reducers/user/userSelectors';

type AuthHookData = {
  username?: string;
  isUserLogged: boolean;
  isLoading: boolean;
  isUserRolesFetched: boolean;
  logout: () => void;
};

function useAuth(): AuthHookData {
  const [isUserRolesFetched, setIsUserRolesFetched] = useState(false);
  const isUserLogged = useSelector(getIsUserLogged);
  const username = useSelector(getUsername);
  const dispatch = useDispatch();

  const [login, { isLoading: isAuthenticateLoading }] =
    osrdGatewayApi.endpoints.login.useMutation();

  const [logout] = osrdGatewayApi.endpoints.logout.useMutation();

  const { data } = osrdEditoastApi.endpoints.getAuthzRolesMe.useQuery(undefined, {
    skip: !isUserLogged,
  });

  useEffect(() => {
    if (!isUserLogged && !isAuthenticateLoading) {
      login();
    }
  }, [isUserLogged]);

  useEffect(() => {
    if (isUserLogged) {
      dispatch(setUserRoles({ userRoles: data?.builtin }));
      setIsUserRolesFetched(true);
    }
  }, [isUserLogged, data]);

  return {
    username,
    isUserLogged,
    isLoading: isAuthenticateLoading,
    isUserRolesFetched,
    logout,
  };
}

export default useAuth;
