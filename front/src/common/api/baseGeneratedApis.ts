import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query/react';

import { MAIN_API } from 'config/config';
import type { RootState } from 'reducers';
import { getImpersonatedUser } from 'reducers/user/userSelectors';

export type ApiError = {
  data: {
    type: string;
    message: string;
    context: object;
  };
  status: number;
};

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseEditoastApi = createApi({
  reducerPath: 'editoastApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${MAIN_API.proxy_editoast}/`,
    prepareHeaders: async (headers, { getState }) => {
      const impersonatedUser = getImpersonatedUser(getState() as RootState);

      if (impersonatedUser) {
        headers.set('x-impersonate', impersonatedUser.identity_id);
      } else {
        headers.delete('x-impersonate');
      }

      return headers;
    },
  }) as BaseQueryFn<FetchArgs, unknown, ApiError>,
  endpoints: () => ({}),
});

export const baseGatewayApi = createApi({
  reducerPath: 'gatewayApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${MAIN_API.proxy_gateway}/`,
  }) as BaseQueryFn<FetchArgs, unknown, ApiError>,
  endpoints: () => ({}),
});
