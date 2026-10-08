import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query/react';

import { MAIN_API } from 'config/config';
import type { RootState } from 'reducers';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { getImpersonatedUser, getFeatureFlags } from 'reducers/user/userSelectors';

export type ApiError = {
  data: {
    type: string;
    message: string;
    context: object;
  };
  status: number;
};

const prepareHeadersWithImpersonate = (headers: Headers, api: { getState: () => unknown }) => {
  const impersonatedUser = getImpersonatedUser(api.getState() as RootState);

  if (impersonatedUser) {
    headers.set('x-impersonate', impersonatedUser.identities[0]);
  } else {
    headers.delete('x-impersonate');
  }

  return headers;
};

const prepareHeadersWithFeatureFlags = (headers: Headers, api: { getState: () => unknown }) => {
  const featureFlags = getFeatureFlags(api.getState() as RootState);
  for (const [flag, value] of Object.entries(featureFlags)) {
    if (value) {
      headers.append('X-feature-flags', flag);
    }
  }
};

const prepareHeaders = async (headers: Headers, api: { getState: () => unknown }) => {
  prepareHeadersWithImpersonate(headers, api);
  prepareHeadersWithFeatureFlags(headers, api);
};

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseEditoastApi = createApi({
  reducerPath: 'editoastApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${MAIN_API.proxy_editoast}/`,
    prepareHeaders,
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

const dynamicBaseQuery: BaseQueryFn<FetchArgs, unknown, ApiError> = (async (
  args,
  api,
  extraOptions
) => {
  const state = api.getState() as RootState;
  const baseUrl = getRailwayManagerInterfaceUrl(state);

  const rawBaseQuery = fetchBaseQuery({ baseUrl, prepareHeaders });

  const result = await rawBaseQuery(args, api, extraOptions);
  return result;
}) as BaseQueryFn<FetchArgs, unknown, ApiError>;

export const baseRailwayManagerApi = createApi({
  reducerPath: 'railwayManagerApi',
  baseQuery: dynamicBaseQuery,
  endpoints: () => ({}),
});
