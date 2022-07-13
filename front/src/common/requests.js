import axios from 'axios';
import mainConfig from 'config/config';

const formatPath = (path) => `${mainConfig.proxy}${path}`;

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
    newPath = `${mainConfig.proxy.replace('/osrd', '')}${path}`;
  } else {
    newPath = formatPath(path);
  }
  // UGLY HACK
  const res = await axios.get(newPath, config);
  return res.data;
};

export const post = async (path, payload, config = {}) => {
  config = { ...getAuthConfig(), ...config };
  const res = await axios.post(formatPath(path), payload, config);
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
