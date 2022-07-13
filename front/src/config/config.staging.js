export const MAIN_API = {
  proxy: process.env.REACT_APP_LOCAL_BACKEND
    ? `http://${window.location.hostname}:8000`
    : 'https://gateway.staging.dgexsol.fr/osrd',
  proxy_chartis: process.env.REACT_APP_LOCAL_BACKEND
    ? `http://${window.location.hostname}:7000/chartis`
    : 'https://gateway.staging.dgexsol.fr/chartos',
  version: '0.0.1.20200408.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export default MAIN_API;
