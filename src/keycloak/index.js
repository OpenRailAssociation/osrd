import Keycloak from './keycloak';
import keycloakConfig from './keycloak.json';

const kc = Keycloak(keycloakConfig);

const { login, logout, isTokenExpired } = kc;

const getToken = () => kc.token;
const getRefreshToken = () => kc.refreshToken;
const getUsername = () => kc.tokenParsed.preferred_username;

const initKeycloak = async (onAuthenticatedCallback) => {
  try {
    const authenticated = await kc.init({
      onLoad: 'login-required',
    });
    if (!authenticated) throw new Error();
    onAuthenticatedCallback();
  } catch (e) {
    login();
  }
};

const updateToken = async (minVal) => {
  const token = await kc.updateToken(minVal);
  return token;
};

export default {
  initKeycloak,
  login,
  logout,
  getToken,
  getRefreshToken,
  updateToken,
  getUsername,
  isTokenExpired,
};
