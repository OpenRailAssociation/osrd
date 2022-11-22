import { emptySplitApi as api } from './emptyApi';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/health` }),
    }),
    getInfra: build.query<GetInfraApiResponse, GetInfraApiArg>({
      query: () => ({ url: `/infra/` }),
    }),
    postInfra: build.mutation<PostInfraApiResponse, PostInfraApiArg>({
      query: (queryArg) => ({ url: `/infra/`, method: 'POST', body: queryArg.body }),
    }),
    getInfraById: build.query<GetInfraByIdApiResponse, GetInfraByIdApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/` }),
    }),
    deleteInfraById: build.mutation<DeleteInfraByIdApiResponse, DeleteInfraByIdApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/`, method: 'DELETE' }),
    }),
    postInfraById: build.mutation<PostInfraByIdApiResponse, PostInfraByIdApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/`, method: 'POST', body: queryArg.body }),
    }),
    getInfraByIdErrors: build.query<GetInfraByIdErrorsApiResponse, GetInfraByIdErrorsApiArg>({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/errors/`,
        params: {
          page: queryArg.page,
          page_size: queryArg.pageSize,
          exclude_warnings: queryArg.excludeWarnings,
        },
      }),
    }),
    getInfraByIdSwitchTypes: build.query<
      GetInfraByIdSwitchTypesApiResponse,
      GetInfraByIdSwitchTypesApiArg
    >({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/switch_types/` }),
    }),
    postInfraRefresh: build.mutation<PostInfraRefreshApiResponse, PostInfraRefreshApiArg>({
      query: (queryArg) => ({
        url: `/infra/refresh/`,
        method: 'POST',
        params: { infras: queryArg.infras, force: queryArg.force },
      }),
    }),
    postInfraByIdLock: build.mutation<PostInfraByIdLockApiResponse, PostInfraByIdLockApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/lock/`, method: 'POST' }),
    }),
    postInfraByIdUnlock: build.mutation<PostInfraByIdUnlockApiResponse, PostInfraByIdUnlockApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/unlock/`, method: 'POST' }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as osrdEditoastApi };
export type GetHealthApiResponse = unknown;
export type GetHealthApiArg = void;
export type GetInfraApiResponse = /** status 200 The infra list */ Infra[];
export type GetInfraApiArg = void;
export type PostInfraApiResponse = /** status 201 The created infra */ Infra;
export type PostInfraApiArg = {
  /** Name of the infra to create */
  body: {
    name?: string;
  };
};
export type GetInfraByIdApiResponse = /** status 200 Information about the retrieved infra */ Infra;
export type GetInfraByIdApiArg = {
  /** infra id */
  id: number;
};
export type DeleteInfraByIdApiResponse = unknown;
export type DeleteInfraByIdApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdApiResponse =
  /** status 200 An array containing infos about the operations processed */ OperationResult[];
export type PostInfraByIdApiArg = {
  /** infra id */
  id: number;
  /** Operations to do on the infra */
  body: Operation[];
};
export type GetInfraByIdErrorsApiResponse = /** status 200 A paginated list of errors */ {
  count?: number;
  next?: number | null;
  previous?: number | null;
  results?: InfraError[];
};
export type GetInfraByIdErrorsApiArg = {
  /** infra id */
  id: number;
  /** The page number */
  page?: number;
  /** The number of item per page */
  pageSize?: number;
  /** Whether the response should include warnings or not */
  excludeWarnings?: boolean;
};
export type GetInfraByIdSwitchTypesApiResponse = /** status 200 A list of switch types */ object[];
export type GetInfraByIdSwitchTypesApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraRefreshApiResponse =
  /** status 200 A list thats contains the ID of the infras that were refreshed* */ number[];
export type PostInfraRefreshApiArg = {
  /** A list of infra ID */
  infras?: number[];
  /** Force the refresh of the layers */
  force?: boolean;
};
export type PostInfraByIdLockApiResponse = unknown;
export type PostInfraByIdLockApiArg = {
  /** infra id */
  id: number;
};
export type PostInfraByIdUnlockApiResponse = unknown;
export type PostInfraByIdUnlockApiArg = {
  /** infra id */
  id: number;
};
export type Infra = {
  id?: number;
  name?: string;
  version?: string;
  generated_version?: string | null;
};
export type ObjectType =
  | 'TrackSection'
  | 'Signal'
  | 'SpeedSection'
  | 'Detector'
  | 'TrackSectionLink'
  | 'Switch'
  | 'SwitchType'
  | 'BufferStop';
export type DeleteOperation = {
  operation_type?: 'DELETE';
  obj_type?: ObjectType;
  obj_id?: string;
};
export type Railjson = object;
export type OperationObject = {
  operation_type?: 'CREATE' | 'UPDATE';
  obj_type?: ObjectType;
  railjson?: Railjson;
};
export type OperationResult =
  | ({
      operation_type: 'DeleteOperation';
    } & DeleteOperation)
  | ({
      operation_type: 'OperationObject';
    } & OperationObject);
export type RailjsonObject = {
  operation_type?: 'CREATE';
  obj_type?: ObjectType;
  railjson?: Railjson;
};
export type Patch = {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: object;
  from?: string;
};
export type Patches = Patch[];
export type UpdateOperation = {
  operation_type?: 'UPDATE';
  obj_type?: ObjectType;
  obj_id?: string;
  railjson_patch?: Patches;
};
export type Operation =
  | ({
      operation_type: 'RailjsonObject';
    } & RailjsonObject)
  | ({
      operation_type: 'DeleteOperation';
    } & DeleteOperation)
  | ({
      operation_type: 'UpdateOperation';
    } & UpdateOperation);
export type InfraError = {
  obj_id?: string;
  obj_type?: ObjectType;
  information?: object;
};
