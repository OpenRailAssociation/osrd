import { MAIN_API } from 'config/config';
import { getAuthConfig } from 'common/requests';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

function prepareHeaders(headers: any) {
  headers.set('Authorization', getAuthConfig()?.headers?.Authorization);
  return headers;
}

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy}/`, prepareHeaders }),
  endpoints: () => ({}),
});
export const baseChartosApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy_chartis}/`, prepareHeaders }),
  endpoints: () => ({}),
});
export const baseEditoastApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy_editoast}/`, prepareHeaders }),
  endpoints: () => ({}),
});
