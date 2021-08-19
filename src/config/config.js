export const MAIN_API = {
  // proxy: 'https://api.dev.dgexsol.fr',
  proxy: 'https://gateway.dev.dgexsol.fr',
  api: process.env.REACT_APP_USE_LOCAL_BACKEND
    ? `http://${window.location.hostname}:8000`
    : 'https://api.dev.dgexsol.fr',
  version: '0.0.1.20200408.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export default MAIN_API;
