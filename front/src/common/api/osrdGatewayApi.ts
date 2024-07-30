import { baseGatewayApi as api } from './baseGeneratedApis';

export const addTagTypes = ['authentication'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      login: build.mutation<LoginApiResponse, LoginApiArg>({
        query: () => ({ url: `/auth/login`, method: 'POST' }),
        invalidatesTags: ['authentication'],
      }),
      logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
        query: () => ({ url: `/auth/logout`, method: 'POST' }),
        invalidatesTags: ['authentication'],
      }),
      getProviders: build.query<GetProvidersApiResponse, GetProvidersApiArg>({
        query: () => ({ url: `/auth/providers` }),
        providesTags: ['authentication'],
      }),
      providerLogin: build.mutation<ProviderLoginApiResponse, ProviderLoginApiArg>({
        query: (queryArg) => ({ url: `/auth/provider/${queryArg.provider}/login`, method: 'POST' }),
        invalidatesTags: ['authentication'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as osrdGatewayApi };
export type LoginApiResponse = /** status 200 successful operation */ LoginResponse;
export type LoginApiArg = void;
export type LogoutApiResponse = /** status 200 successful operation */ LogoutResponse;
export type LogoutApiArg = void;
export type GetProvidersApiResponse = /** status 200 successful operation */ Provider[];
export type GetProvidersApiArg = void;
export type ProviderLoginApiResponse = /** status 200 successful operation */ LoginResponse;
export type ProviderLoginApiArg = {
  /** The authentication session provider identifier */
  provider: string;
};
export type LoginSuccess = {
  type: 'success';
  username: string;
};
export type LoginRedirect = {
  type: 'redirect';
  url: string;
};
export type LoginResponse =
  | ({
      type: 'LoginSuccess';
    } & LoginSuccess)
  | ({
      type: 'LoginRedirect';
    } & LoginRedirect);
export type LogoutResponse = {
  type: 'success';
};
export type Provider = {
  backend: string;
  provider_id: string;
};
