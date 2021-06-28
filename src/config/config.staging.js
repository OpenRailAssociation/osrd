export const MAIN_API = {
  // proxy: 'https://api.dev.dgexsol.fr',
  proxy: 'https://gateway.staging.dgexsol.fr',
  api: process.env.REACT_APP_USE_LOCAL_BACKEND
    ? `http://${window.location.hostname}:8000`
    : 'https://api.staging.dgexsol.fr',
  version: '0.0.1.20200408.1',
};

export default MAIN_API;
