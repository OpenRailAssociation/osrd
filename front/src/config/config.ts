export const MAIN_API = {
  proxy_editoast: '/api',
  proxy_gateway: '',
  version: '0.0.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export const SENTRY_CONFIG = {
  react_sentry_dsn: import.meta.env.OSRD_SENTRY_DSN,
  environment: import.meta.env.OSRD_SENTRY_ENVIRONMENT,
};

export default MAIN_API;
