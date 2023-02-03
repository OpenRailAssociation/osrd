import Keycloak from 'keycloak-js';
import { KEYCLOAK_CONFIG as keycloakConfig } from 'config/config';

const kc = new Keycloak(keycloakConfig);

const { login, logout, isTokenExpired } = kc;

const getToken = () => kc.token || '';
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
    console.error(e);
    login();
  }
};

const updateToken = async (minVal) => {
  const token = await kc.updateToken(minVal);
  return token;
};

// eslint-disable-next-line import/no-anonymous-default-export
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
