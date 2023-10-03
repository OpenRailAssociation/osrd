import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import mainConfig from 'config/config';

/**
 * Given a path to query, returns the full url.
 */
function formatPath(path: string): string {
  return `${mainConfig.proxy_editoast}${path}`;
}

/**
 * Parse the axios error and build an array of error.
 */
function handleAxiosError(e: unknown): Error {
  let error: null | Error = null;
  // axios error
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError;
    if (err.response && err.response.data) {
      if (Array.isArray(err.response.data))
        error = new Error(
          err.response.data.map((e2) => new Error(e2.message || JSON.stringify(e2))).join('\n')
        );
      else {
        // we can't know the type of the result right now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error = new Error((err.response.data as any).message || JSON.stringify(err.response.data));
      }
    }
    if (!error && err.response && err.response.status) {
      error = new Error(`Request failed: ${err.response.status}`);
    }
    if (!error && err.request) {
      error = new Error('Timeout : no response from the server');
    }
    if (!error && err.code) {
      error = new Error(`Request failed with code ${err.code}`);
    }
  }

  // normal error
  if (!error && e instanceof Error) {
    error = e;
  }

  return error || new Error('An unknown error occured');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function get<T = any>(
  path: string,
  headers?: { [key: string]: string | number | boolean | unknown }
): Promise<T> {
  try {
    const res = await axios.get<T>(formatPath(path), headers);
    return res.data;
  } catch (e) {
    throw handleAxiosError(e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function post<P = any, R = any>(
  path: string,
  payload: P,
  config: AxiosRequestConfig = {}
): Promise<R> {
  try {
    const res = await axios.post<R>(formatPath(path), payload, config);
    return res.data;
  } catch (err) {
    throw handleAxiosError(err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function patch<P = any, T = any>(
  path: string,
  payload: P,
  config: AxiosRequestConfig = {}
): Promise<T> {
  try {
    const { data } = await axios.patch<T>(formatPath(path), payload, config);
    return data;
  } catch (err) {
    throw handleAxiosError(err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function patchMultipart<T = any>(
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const formData = new FormData();
  Object.keys(payload).forEach((key) => {
    formData.append(key, payload[key]);
  });
  try {
    const { data } = await axios.patch(formatPath(path), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...config,
    });
    return data;
  } catch (err) {
    throw handleAxiosError(err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function put<P = any, T = any>(
  path: string,
  payload: P,
  config: AxiosRequestConfig = {}
) {
  try {
    const { data } = await axios.put<T>(formatPath(path), payload, config);
    return data;
  } catch (err) {
    throw handleAxiosError(err);
  }
}

export async function deleteRequest<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const { data } = await axios.delete<T>(formatPath(path), config);
    return data;
  } catch (err) {
    throw handleAxiosError(err);
  }
}
