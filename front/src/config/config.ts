export const MAIN_API = {
  proxy: import.meta.env.OSRD_API_URL,
  proxy_editoast: import.meta.env.OSRD_EDITOAST_URL,
  version: '0.0.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export const KEYCLOAK_CONFIG = {
  realm: import.meta.env.OSRD_KEYCLOAK_REALM, // shared or staging
  url: 'https://keycloak.shared.dgexsol.fr/auth/',
  'ssl-required': 'external',
  resource: 'gateway',
  'public-client': true,
  'confidential-port': 0,
  clientId: 'gateway',
};

export const SENTRY_CONFIG = {
  react_sentry_dsn: import.meta.env.OSRD_SENTRY_DSN,
  environment: import.meta.env.OSRD_SENTRY_ENVIRONMENT,
};

export default MAIN_API;
