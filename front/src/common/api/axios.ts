import axios, { AxiosRequestConfig } from 'axios';
import { mapValues } from 'lodash';

function serializeParams(params: AxiosRequestConfig['params']) {
  const result = mapValues(params, (param) => {
    if (typeof param === 'object') {
      return JSON.stringify(param);
    }
    return param;
  });
  return result;
}

/**
 * Custom axios get which checks if one of the params is an objet.
 * If it is, we stringify it because axios doesn't handle that
 */
function customGet<D>(path: string, config: AxiosRequestConfig<D>) {
  const serializedParams = serializeParams(config.params);
  return axios.get(path, { params: serializedParams });
}

const customAxios = {
  get: customGet,
};

export default customAxios;
