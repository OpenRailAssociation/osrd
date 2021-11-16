export const MAIN_API = {
  proxy: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}`
    : 'https://gateway.dev.dgexsol.fr/osrd',
  proxy_chartis: process.env.REACT_APP_CHARTIS_URL
    ? `${process.env.REACT_APP_CHARTIS_URL}`
    : 'https://gateway.dev.dgexsol.fr/chartis',
  version: '0.0.1.20200408.1',
  editor: {
    component_identifier: { database: 'gaia', name: 'Test' },
  },
};

export default MAIN_API;
