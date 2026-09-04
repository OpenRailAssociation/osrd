import type { QueryReturnValue } from '@reduxjs/toolkit/query';
import { vi, type Mock } from 'vitest';

import type { ApiError } from '../baseGeneratedApis';
import { osrdEditoastApi } from '../osrdEditoastApi';

/**
 * Object type holding all defined API endpoints.
 */
type Endpoints = (typeof osrdEditoastApi)['endpoints'];

type PromiseOr<T> = T | Promise<T>;

/**
 * Given an endpoint type, extract its argument and result types and build a
 * mock function type.
 *
 * This allows us to type-check that the mocked endpoints get the proper query
 * arguments and returns a type that reflects the one that would actually be
 * returned by the endpoint if it wasn't mocked.
 */
type MockQueryFn<E> = E extends { Types: { QueryArg: infer A; ResultType: infer R } }
  ? Mock<(arg: A) => PromiseOr<QueryReturnValue<R, ApiError>>>
  : never;

/**
 * Mapped type providing a typed mock function for each defined API endpoint.
 */
type MockApi = {
  [Name in keyof Endpoints]: MockQueryFn<Endpoints[Name]>;
};

// Create a mock function for each endpoint
const mockEndpointEntries = Object.keys(osrdEditoastApi.endpoints).map(
  (name) => [name, vi.fn()] as const
);

/**
 * Exposes type-safe mocked functions for each endpoint.
 *
 * vitest's .mockResolvedValue() and expect().toHaveBeenCalledWith() functions
 * can be used on these mocked functions.
 *
 * To use these mocks from a test, renderHookWithStore() needs to be used
 * because rtk-query requires a Redux store.
 */
const mockEndpoints = Object.fromEntries(mockEndpointEntries) as MockApi;
// ↑ Unfortunately we need a cast here: TypeScript disregards
// Object.fromEntries() input types and always produces objects with string
// keys.

/**
 * Given a function taking any number of arguments, return a function which
 * only accepts the first one.
 *
 * rtk-query calls queryFn with 4 arguments, but we only care about the first
 * one which contains the QueryArg. This allows us to leverage
 * expect().toHaveBeenCalledWith() to only check QueryArg.
 */
function callWithOnlyFirstParam<F extends (arg: unknown) => unknown>(f: F) {
  return (arg: Parameters<F>[0]) => f(arg);
}

// Override endpoint query functions with mocks
const mockApi = osrdEditoastApi.enhanceEndpoints({
  endpoints: Object.fromEntries(
    mockEndpointEntries.map(([name, f]) => [
      name,
      {
        query: undefined,
        queryFn: callWithOnlyFirstParam(f),
      },
    ])
  ),
}) as unknown as typeof osrdEditoastApi;
// ↑ Unfortunately we need a cast here, because .enhanceEndpoints() never
// returns the exact same type as the original even if no new
// tags/endpoints got added, and Typescript can't know we didn't do that.

export {
  // This is the test-facing part of the API mocking framework.
  mockEndpoints as mockOsrdEditoastEndpoints,

  // This is the hook/component-facing part of the mocked API, that will be
  // used in place of the real osrdEditoastApi.
  //
  // Because this file is placed in a __mocks__ directory, vitest will load it
  // by default when vi.mock('common/api/osrdEditoastApi') is called by
  // vite.setup.ts.
  mockApi as osrdEditoastApi,
};
