export const MAIN_API = {
  proxy_editoast: import.meta.env.VITE_PROXY_EDITOAST ?? '/api',
  proxy_gateway: import.meta.env.VITE_PROXY_GATEWAY ?? '',
  version: '0.0.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export default MAIN_API;
