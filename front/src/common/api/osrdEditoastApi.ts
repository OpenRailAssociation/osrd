import { emptySplitApi as api } from './emptyApi';
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/health/` }),
    }),
    getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
      query: () => ({ url: `/version/` }),
    }),
    getLayersInfo: build.query<GetLayersInfoApiResponse, GetLayersInfoApiArg>({
      query: () => ({ url: `/layers/info/` }),
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
    putInfraById: build.mutation<PutInfraByIdApiResponse, PutInfraByIdApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/`, method: 'PUT', body: queryArg.body }),
    }),
    getInfraByIdRailjson: build.query<GetInfraByIdRailjsonApiResponse, GetInfraByIdRailjsonApiArg>({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/railjson/`,
        params: { exclude_extensions: queryArg.excludeExtensions },
      }),
    }),
    postInfraRailjson: build.mutation<PostInfraRailjsonApiResponse, PostInfraRailjsonApiArg>({
      query: (queryArg) => ({
        url: `/infra/railjson/`,
        method: 'POST',
        body: queryArg.railjsonFile,
        params: { name: queryArg.name, generate_data: queryArg.generateData },
      }),
    }),
    getInfraByIdErrors: build.query<GetInfraByIdErrorsApiResponse, GetInfraByIdErrorsApiArg>({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/errors/`,
        params: {
          page: queryArg.page,
          page_size: queryArg.pageSize,
          error_type: queryArg.errorType,
          object_id: queryArg.objectId,
          level: queryArg.level,
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
    getInfraByIdSpeedLimitTags: build.query<
      GetInfraByIdSpeedLimitTagsApiResponse,
      GetInfraByIdSpeedLimitTagsApiArg
    >({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/speed_limit_tags/` }),
    }),
    getInfraByIdVoltages: build.query<GetInfraByIdVoltagesApiResponse, GetInfraByIdVoltagesApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/voltages/` }),
    }),
    getInfraByIdRoutesAndWaypointTypeWaypointId: build.query<
      GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse,
      GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg
    >({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/routes/${queryArg.waypointType}/${queryArg.waypointId}/`,
      }),
    }),
    getInfraByIdRoutesTrackRanges: build.query<
      GetInfraByIdRoutesTrackRangesApiResponse,
      GetInfraByIdRoutesTrackRangesApiArg
    >({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/routes/track_ranges/`,
        params: { routes: queryArg.routes },
      }),
    }),
    postInfraByIdObjectsAndObjectType: build.mutation<
      PostInfraByIdObjectsAndObjectTypeApiResponse,
      PostInfraByIdObjectsAndObjectTypeApiArg
    >({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/objects/${queryArg.objectType}/`,
        method: 'POST',
        body: queryArg.body,
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as osrdEditoastApi };
export type GetHealthApiResponse = unknown;
export type GetHealthApiArg = void;
export type GetVersionApiResponse = /** status 200 Return the service version */ {
  git_describe: string | null;
};
export type GetVersionApiArg = void;
export type GetLayersInfoApiResponse = /** status 200 Successful Response */ Layer[];
export type GetLayersInfoApiArg = void;
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
export type PutInfraByIdApiResponse = /** status 200 The updated infra */ Infra;
export type PutInfraByIdApiArg = {
  /** infra id */
  id: number;
  /** the name we want to give to the infra */
  body: {
    name?: string;
  };
};
export type GetInfraByIdRailjsonApiResponse =
  /** status 200 The infra in railjson format */ RailjsonFile;
export type GetInfraByIdRailjsonApiArg = {
  /** Infra ID */
  id: number;
  /** Whether the railjson should contain extensions */
  excludeExtensions?: boolean;
};
export type PostInfraRailjsonApiResponse = /** status 201 The imported infra id */ {
  id?: string;
};
export type PostInfraRailjsonApiArg = {
  /** Infra name */
  name: string;
  generateData?: boolean;
  /** Railjson infra */
  railjsonFile: RailjsonFile;
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
  /** The type of error to filter on */
  errorType?:
    | 'invalid_reference'
    | 'out_of_range'
    | 'empty_path'
    | 'path_does_not_match_endpoints'
    | 'unknown_port_name'
    | 'invalid_switch_ports'
    | 'empty_object'
    | 'object_out_of_path'
    | 'missing_route'
    | 'unused_port'
    | 'duplicated_group'
    | 'no_buffer_stop'
    | 'path_is_not_continuous'
    | 'overlapping_switches'
    | 'overlapping_track_links';
  /** errors and warnings that only part of a given object */
  objectId?: string;
  /** Whether the response should include errors or warnings */
  level?: 'errors' | 'warnings' | 'all';
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
export type GetInfraByIdSpeedLimitTagsApiResponse = /** status 200 Tags list */ string[];
export type GetInfraByIdSpeedLimitTagsApiArg = {
  /** Infra id */
  id: number;
};
export type GetInfraByIdVoltagesApiResponse = /** status 200 Voltages list */ number[];
export type GetInfraByIdVoltagesApiArg = {
  /** Infra ID */
  id: number;
};
export type GetInfraByIdRoutesAndWaypointTypeWaypointIdApiResponse =
  /** status 200 All routes that starting and ending by the given waypoint */ {
    starting?: string[];
    ending?: string[];
  };
export type GetInfraByIdRoutesAndWaypointTypeWaypointIdApiArg = {
  /** Infra ID */
  id: number;
  /** Type of the waypoint */
  waypointType: 'Detector' | 'BufferStop';
  /** The waypoint id */
  waypointId: string;
};
export type GetInfraByIdRoutesTrackRangesApiResponse =
  /** status 200 Foreach route, the track ranges through which it passes or an error */ (
    | ({
        type: 'NotFound';
      } & NotFound)
    | ({
        type: 'CantComputePath';
      } & CantComputePath)
    | ({
        type: 'Computed';
      } & Computed)
  )[];
export type GetInfraByIdRoutesTrackRangesApiArg = {
  /** Infra ID */
  id: number;
  routes: string;
};
export type PostInfraByIdObjectsAndObjectTypeApiResponse = /** status 200 No content */ {
  railjson?: object;
  geographic?: object;
  schematic?: object;
}[];
export type PostInfraByIdObjectsAndObjectTypeApiArg = {
  /** Infra id */
  id: number;
  /** The type of the object */
  objectType: ObjectType;
  /** List of object id's */
  body: string[];
};
export type MapLayerView = {
  name?: string;
  on_field?: string;
  data_expr?: string[];
  exclude_fields?: string[];
  joins?: string[];
  cache_duration?: number;
  where?: string[];
};
export type Layer = {
  name?: string;
  table_name?: string;
  views?: MapLayerView[];
  id_field?: string;
  attribution?: string;
};
export type Infra = {
  id?: number;
  name?: string;
  version?: string;
  generated_version?: string | null;
  created?: string;
  modified?: string;
  locked?: boolean;
};
export type ObjectType =
  | 'TrackSection'
  | 'Signal'
  | 'SpeedSection'
  | 'Detector'
  | 'TrackSectionLink'
  | 'Switch'
  | 'SwitchType'
  | 'BufferStop'
  | 'Route'
  | 'OperationalPoint'
  | 'Catenary';
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
export type RailjsonFile = {
  version?: string;
  operational_points?: any;
  routes?: any;
  switch_types?: any;
  switches?: any;
  track_section_links?: any;
  track_sections?: any;
  signals?: any;
  buffer_stops?: any;
  speed_sections?: any;
  catenaries?: any;
  detectors?: any;
};
export type InfraError = {
  geographic?: object | null;
  schematic?: object | null;
  information?: object;
};
export type NotFound = {
  type?: 'NotFound';
};
export type CantComputePath = {
  type?: 'CantComputePath';
};
export type Computed = {
  type?: 'Computed';
  track_ranges?: {
    track?: string;
    begin?: number;
    end?: number;
    applicable_directions?: 'START_TO_STOP' | 'STOP_TO_START';
  }[];
};
