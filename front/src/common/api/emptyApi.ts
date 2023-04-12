import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs } from '@reduxjs/toolkit/query/react';
import { isNil } from 'lodash';

import { MAIN_API } from 'config/config';
import { getAuthConfig } from 'common/requests';

interface ApiError {
  data: {
    type: string;
    message: string;
    context: object;
  };
  status: number;
}

function prepareHeaders(headers: Headers) {
  const authValue = getAuthConfig().headers?.Authorization;
  if (!isNil(authValue)) {
    headers.set('Authorization', `${authValue}`);
  }
  return headers;
}

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy}/`, prepareHeaders }),
  endpoints: () => ({}),
});
export const baseEditoastApi = createApi({
  reducerPath: 'editoastApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${MAIN_API.proxy_editoast}/`,
    prepareHeaders,
  }) as BaseQueryFn<FetchArgs, unknown, ApiError>,
  endpoints: () => ({}),
});
