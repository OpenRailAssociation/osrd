/* eslint-disable @typescript-eslint/no-use-before-define */
import { osrdGatewayApi } from 'common/api/osrdGatewayApi';
import type { AppStartListening } from 'store/listenerMiddleware';
import { loginSuccess, loginError, logoutSuccess } from '.';

export default function addUserListeners(startListening: AppStartListening) {
  handleAuthAuthenticateSuccess(startListening);
  handleAuthAuthenticateFailed(startListening);
  handleAuthLogoutSuccess(startListening);
}

function handleAuthAuthenticateSuccess(startListening: AppStartListening) {
  startListening({
    matcher: osrdGatewayApi.endpoints.login.matchFulfilled,
    effect: (action, listenerApi) => {
      const { payload } = action;
      switch (payload.type) {
        case 'redirect': {
          window.location.href = payload.url;
          break;
        }
        case 'success': {
          listenerApi.dispatch(
            loginSuccess({
              username: payload.username,
            })
          );
          break;
        }
        default: {
          throw new Error('Authentication response type');
        }
      }
    },
  });
}

function handleAuthAuthenticateFailed(startListening: AppStartListening) {
  startListening({
    matcher: osrdGatewayApi.endpoints.login.matchRejected,
    effect: (action, listenerApi) => {
      listenerApi.dispatch(loginError(action.payload));
    },
  });
}

function handleAuthLogoutSuccess(startListening: AppStartListening) {
  startListening({
    matcher: osrdGatewayApi.endpoints.logout.matchFulfilled,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(logoutSuccess());
    },
  });
}
