import { MAIN_API } from 'config/config';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// initialize an empty api service that we'll inject endpoints into later as needed
export const baseApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy}/` }),
  endpoints: () => ({}),
});
export const baseChartosApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy_chartis}/` }),
  endpoints: () => ({}),
});
export const baseEditoastApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${MAIN_API.proxy_editoast}/` }),
  endpoints: () => ({}),
});
