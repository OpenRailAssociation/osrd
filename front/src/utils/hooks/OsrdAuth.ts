import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { osrdEditoastApi, type GetAuthzRolesMeApiResponse } from 'common/api/osrdEditoastApi';
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import type { Subject } from 'common/UserSettings';
import { setUserName, setUserRoles } from 'reducers/user';
import { getIsUserLogged, getImpersonatedUser, getUsername } from 'reducers/user/userSelectors';

type AuthHookData = {
  data?: GetAuthzRolesMeApiResponse;
  username?: string;
  isUserLogged: boolean;
  impersonatedUser?: Subject;
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

  const { data } = osrdEditoastApi.endpoints.getAuthzRolesMe.useQuery(undefined, {
    skip: !isUserLogged,
  });

  useEffect(() => {
    if (!isUserLogged && !isAuthenticateLoading) {
      login();
    }
  }, [isUserLogged]);

  useEffect(() => {
    if (data && !impersonatedUser) {
      dispatch(setUserRoles(data?.builtin));
    } else {
      dispatch(setUserRoles(impersonatedUser?.type));
      dispatch(setUserName(impersonatedUser?.name));
    }
  }, [isUserLogged, impersonatedUser, data]);

  return {
    data,
    // TODO : Récupérer le nom d'origine de l'utilisateur
    username: impersonatedUser ? username : 'Exemple User',
    isUserLogged,
    impersonatedUser,
    isLoading: isAuthenticateLoading || !data,
    logout,
  };
}

export default useAuth;
