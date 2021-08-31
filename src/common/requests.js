import axios from 'axios';
import mainConfig from 'config/config';

const formatPath = (path) => `${mainConfig.proxy}${path}${path.slice(-1) !== '/' ? '/' : ''}`;

const getAuthConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  },
});

export const get = async (path, params = undefined) => {
  const config = getAuthConfig();
  if (params) {
    config.params = params;
  }
  let newPath;
  // ULGY HACK https://gateway.dev.dgexsol.fr/osrd
  if (path.substr(0, 5) === '/gaia') {
    newPath = `${mainConfig.proxy.substr(0, 30)}${path}${path.slice(-1) !== '/' ? '/' : ''}`;
  } else {
    newPath = formatPath(path);
  }
  // UGLY HACK
  const res = await axios.get(newPath, config);
  return res.data;
};

export const post = async (path, payload, config = {}, proxyGateway = false) => {
  config = { ...getAuthConfig(), ...config };
  const formattedPath = proxyGateway ? formatPathGateway(path) : formatPath(path);
  const res = await axios.post(formattedPath, payload, config);
  return res.data;
};

export const patch = async (path, payload) => {
  const config = getAuthConfig();
  const { data } = await axios.patch(formatPath(path), payload, config);
  return data;
};

export const put = async (path, payload, config = {}) => {
  config = { ...getAuthConfig(), ...config };
  const { data } = await axios.put(formatPath(path), payload, config);
  return data;
};

export const deleteRequest = async (path) => {
  const config = getAuthConfig();
  const { data } = await axios.delete(formatPath(path), config);
  return data;
};
