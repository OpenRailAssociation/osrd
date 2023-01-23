import { env } from 'env';

export const MAIN_API = {
  proxy: env.REACT_APP_API_URL,
  proxy_editoast: env.REACT_APP_EDITOAST_URL,
  version: '0.0.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export const KEYCLOAK_CONFIG = {
  realm: env.REACT_APP_KEYCLOAK_REALM, // shared or staging
  url: 'https://keycloak.shared.dgexsol.fr/auth/',
  'ssl-required': 'external',
  resource: 'gateway',
  'public-client': true,
  'confidential-port': 0,
  clientId: 'gateway',
};

export const SENTRY_CONFIG = {
  react_sentry_dsn: env.REACT_APP_SENTRY_DSN,
  environment: env.REACT_APP_SENTRY_ENVIRONMENT,
};

export default MAIN_API;
