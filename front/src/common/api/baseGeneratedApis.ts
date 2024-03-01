import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query/react';

import { MAIN_API } from 'config/config';

export interface ApiError {
  data: {
    type: string;
    message: string;
    context: object;
  };
  status: number;
}

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseEditoastApi = createApi({
  reducerPath: 'editoastApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${MAIN_API.proxy_editoast}/`,
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
