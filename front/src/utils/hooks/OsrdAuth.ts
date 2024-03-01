import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import { getIsUserLogged, getUsername } from 'reducers/user/userSelectors';

type AuthHookData = {
  username?: string;
  isUserLogged: boolean;
  isLoading: boolean;
  logout: () => void;
};

function useAuth(): AuthHookData {
  const isUserLogged = useSelector(getIsUserLogged);
  const username = useSelector(getUsername);

  const [login, { isLoading: isAuthenticateLoading }] =
    osrdGatewayApi.endpoints.login.useMutation();
  const [logout] = osrdGatewayApi.endpoints.logout.useMutation();

  useEffect(() => {
    if (!isUserLogged && !isAuthenticateLoading) {
      login();
    }
  }, [isUserLogged]);

  return {
    username,
    isUserLogged,
    isLoading: isAuthenticateLoading,
    logout,
  };
}

export default useAuth;
