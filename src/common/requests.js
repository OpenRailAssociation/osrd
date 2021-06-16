import axios from 'axios';
import mainConfig from 'config/config';

const formatPath = (path) => `${mainConfig.api}${path}${path.slice(-1) !== '/' ? '/' : ''}`;
const formatPathGateway = (path) => `${mainConfig.proxy}${path}${path.slice(-1) !== '/' ? '/' : ''}`;

const getAuthConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  },
});

export const get = async (path, params = undefined, proxyGateway = false) => {
  const config = getAuthConfig();
  const formattedPath = proxyGateway ? formatPathGateway(path) : formatPath(path);
  if (params) {
    config.params = params;
  }
  const res = await axios.get(formattedPath, config);
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

export const deleteRequest = async (path, proxyGateway = false) => {
  const config = getAuthConfig();
  const formattedPath = proxyGateway ? formatPathGateway(path) : formatPath(path);
  const { data } = await axios.delete(formattedPath, config);
  return data;
};
