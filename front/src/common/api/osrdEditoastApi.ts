import { baseEditoastApi as api } from './emptyApi';

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/health/` }),
    }),
    getVersion: build.query<GetVersionApiResponse, GetVersionApiArg>({
      query: () => ({ url: `/version/` }),
    }),
    postSearch: build.mutation<PostSearchApiResponse, PostSearchApiArg>({
      query: (queryArg) => ({ url: `/search/`, method: 'POST', body: queryArg.body }),
    }),
    getLayersLayerByLayerSlugMvtAndViewSlug: build.query<
      GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse,
      GetLayersLayerByLayerSlugMvtAndViewSlugApiArg
    >({
      query: (queryArg) => ({
        url: `/layers/layer/${queryArg.layerSlug}/mvt/${queryArg.viewSlug}/`,
        params: { infra: queryArg.infra },
      }),
    }),
    getLayersTileByLayerSlugAndViewSlugZXY: build.query<
      GetLayersTileByLayerSlugAndViewSlugZXYApiResponse,
      GetLayersTileByLayerSlugAndViewSlugZXYApiArg
    >({
      query: (queryArg) => ({
        url: `/layers/tile/${queryArg.layerSlug}/${queryArg.viewSlug}/${queryArg.z}/${queryArg.x}/${queryArg.y}/`,
        params: { infra: queryArg.infra },
      }),
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
    getInfraByIdLinesAndLineCodeBbox: build.query<
      GetInfraByIdLinesAndLineCodeBboxApiResponse,
      GetInfraByIdLinesAndLineCodeBboxApiArg
    >({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/lines/${queryArg.lineCode}/bbox` }),
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
    getInfraByIdAttachedAndTrackId: build.query<
      GetInfraByIdAttachedAndTrackIdApiResponse,
      GetInfraByIdAttachedAndTrackIdApiArg
    >({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/attached/${queryArg.trackId}/` }),
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
    postInfraByIdPathfinding: build.mutation<
      PostInfraByIdPathfindingApiResponse,
      PostInfraByIdPathfindingApiArg
    >({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/pathfinding/`,
        method: 'POST',
        body: queryArg.body,
        params: { number: queryArg.number },
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
    postInfraByIdClone: build.mutation<PostInfraByIdCloneApiResponse, PostInfraByIdCloneApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/clone/`, method: 'POST' }),
    }),
    getElectricalProfileSet: build.query<
      GetElectricalProfileSetApiResponse,
      GetElectricalProfileSetApiArg
    >({
      query: () => ({ url: `/electrical_profile_set/` }),
    }),
    postElectricalProfileSet: build.mutation<
      PostElectricalProfileSetApiResponse,
      PostElectricalProfileSetApiArg
    >({
      query: (queryArg) => ({
        url: `/electrical_profile_set/`,
        method: 'POST',
        params: { name: queryArg.name },
      }),
    }),
    getElectricalProfileSetById: build.query<
      GetElectricalProfileSetByIdApiResponse,
      GetElectricalProfileSetByIdApiArg
    >({
      query: (queryArg) => ({ url: `/electrical_profile_set/${queryArg.id}/` }),
    }),
    getElectricalProfileSetByIdLevelOrder: build.query<
      GetElectricalProfileSetByIdLevelOrderApiResponse,
      GetElectricalProfileSetByIdLevelOrderApiArg
    >({
      query: (queryArg) => ({ url: `/electrical_profile_set/${queryArg.id}/level_order/` }),
    }),
    getDocumentsByKey: build.query<GetDocumentsByKeyApiResponse, GetDocumentsByKeyApiArg>({
      query: (queryArg) => ({ url: `/documents/${queryArg.key}/` }),
    }),
    deleteDocumentsByKey: build.mutation<
      DeleteDocumentsByKeyApiResponse,
      DeleteDocumentsByKeyApiArg
    >({
      query: (queryArg) => ({ url: `/documents/${queryArg.key}/`, method: 'DELETE' }),
    }),
    postDocuments: build.mutation<PostDocumentsApiResponse, PostDocumentsApiArg>({
      query: () => ({ url: `/documents/`, method: 'POST' }),
    }),
    getLightRollingStock: build.query<GetLightRollingStockApiResponse, GetLightRollingStockApiArg>({
      query: (queryArg) => ({
        url: `/light_rolling_stock/`,
        params: { page: queryArg.page, page_size: queryArg.pageSize },
      }),
    }),
    getLightRollingStockById: build.query<
      GetLightRollingStockByIdApiResponse,
      GetLightRollingStockByIdApiArg
    >({
      query: (queryArg) => ({ url: `/light_rolling_stock/${queryArg.id}/` }),
    }),
    getRollingStockById: build.query<GetRollingStockByIdApiResponse, GetRollingStockByIdApiArg>({
      query: (queryArg) => ({ url: `/rolling_stock/${queryArg.id}/` }),
    }),
    postProjects: build.mutation<PostProjectsApiResponse, PostProjectsApiArg>({
      query: (queryArg) => ({
        url: `/projects/`,
        method: 'POST',
        body: queryArg.projectCreateRequest,
      }),
    }),
    getProjects: build.query<GetProjectsApiResponse, GetProjectsApiArg>({
      query: (queryArg) => ({
        url: `/projects/`,
        params: {
          ordering: queryArg.ordering,
          name: queryArg.name,
          description: queryArg.description,
          tags: queryArg.tags,
          page: queryArg.page,
          page_size: queryArg.pageSize,
        },
      }),
    }),
    getProjectsByProjectId: build.query<
      GetProjectsByProjectIdApiResponse,
      GetProjectsByProjectIdApiArg
    >({
      query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/` }),
    }),
    patchProjectsByProjectId: build.mutation<
      PatchProjectsByProjectIdApiResponse,
      PatchProjectsByProjectIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/`,
        method: 'PATCH',
        body: queryArg.projectPatchRequest,
      }),
    }),
    deleteProjectsByProjectId: build.mutation<
      DeleteProjectsByProjectIdApiResponse,
      DeleteProjectsByProjectIdApiArg
    >({
      query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/`, method: 'DELETE' }),
    }),
    postProjectsByProjectIdStudies: build.mutation<
      PostProjectsByProjectIdStudiesApiResponse,
      PostProjectsByProjectIdStudiesApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/`,
        method: 'POST',
        body: queryArg.studyCreateRequest,
      }),
    }),
    deleteProjectsByProjectIdStudiesAndStudyId: build.mutation<
      DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse,
      DeleteProjectsByProjectIdStudiesAndStudyIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
        method: 'DELETE',
      }),
    }),
    getRollingStockByIdLiveryAndLiveryId: build.query<
      GetRollingStockByIdLiveryAndLiveryIdApiResponse,
      GetRollingStockByIdLiveryAndLiveryIdApiArg
    >({
      query: (queryArg) => ({ url: `/rolling_stock/${queryArg.id}/livery/${queryArg.liveryId}` }),
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
export type PostSearchApiResponse =
  /** status 200 Search results, the structure of the returned objects depend on their type */ object[];
export type PostSearchApiArg = {
  /** Search query */
  body: {
    object?: string;
    query?: SearchQuery;
    page?: number;
    page_size?: number;
  };
};
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiResponse =
  /** status 200 Successful Response */ ViewMetadata;
export type GetLayersLayerByLayerSlugMvtAndViewSlugApiArg = {
  layerSlug: string;
  viewSlug: string;
  infra: number;
};
export type GetLayersTileByLayerSlugAndViewSlugZXYApiResponse = unknown;
export type GetLayersTileByLayerSlugAndViewSlugZXYApiArg = {
  layerSlug: string;
  viewSlug: string;
  z: number;
  x: number;
  y: number;
  infra: number;
};
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
export type GetInfraByIdLinesAndLineCodeBboxApiResponse =
  /** status 200 The BBox of the line */ Zone;
export type GetInfraByIdLinesAndLineCodeBboxApiArg = {
  /** infra id */
  id: number;
  /** a line code */
  lineCode: number;
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
export type GetInfraByIdAttachedAndTrackIdApiResponse =
  /** status 200 All objects attached to the given track (arranged by types) */ {
    [key: string]: string[];
  };
export type GetInfraByIdAttachedAndTrackIdApiArg = {
  /** Infra ID */
  id: number;
  /** Track ID */
  trackId: string;
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
        type: 'RouteTrackRangesNotFoundError';
      } & RouteTrackRangesNotFoundError)
    | ({
        type: 'RouteTrackRangesCantComputePathError';
      } & RouteTrackRangesCantComputePathError)
    | ({
        type: 'RouteTrackRangesComputed';
      } & RouteTrackRangesComputed)
  )[];
export type GetInfraByIdRoutesTrackRangesApiArg = {
  /** Infra ID */
  id: number;
  routes: string;
};
export type PostInfraByIdPathfindingApiResponse =
  /** status 200 Paths, containing track ranges, detectors and switches with their directions. If no path is found, an empty list is returned. */ {
    track_ranges?: DirectionalTrackRange[];
    detectors?: string[];
    switches_directions?: {
      [key: string]: string;
    };
  }[];
export type PostInfraByIdPathfindingApiArg = {
  /** Infra ID */
  id: number;
  /** Maximum number of paths to return */
  number?: number;
  /** Starting and ending track location */
  body: {
    starting?: TrackLocation & {
      direction?: Direction;
    };
    ending?: TrackLocation;
  };
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
export type PostInfraByIdCloneApiResponse = /** status 201 The duplicated infra id */ {
  id?: number;
};
export type PostInfraByIdCloneApiArg = {
  /** Infra id */
  id: number;
};
export type GetElectricalProfileSetApiResponse =
  /** status 200 The list of ids and names of electrical profile sets available */ {
    id?: number;
    name?: string;
  }[];
export type GetElectricalProfileSetApiArg = void;
export type PostElectricalProfileSetApiResponse =
  /** status 200 The list of ids and names of electrical profile sets available */ ElectricalProfile;
export type PostElectricalProfileSetApiArg = {
  name: string;
};
export type GetElectricalProfileSetByIdApiResponse =
  /** status 200 The list of electrical profiles in the set */ ElectricalProfile[];
export type GetElectricalProfileSetByIdApiArg = {
  /** Electrical profile set ID */
  id: number;
};
export type GetElectricalProfileSetByIdLevelOrderApiResponse =
  /** status 200 A dictionary mapping catenary modes to a list of electrical profiles ordered by decreasing strength */ {
    [key: string]: string[];
  };
export type GetElectricalProfileSetByIdLevelOrderApiArg = {
  /** Electrical profile set ID */
  id: number;
};
export type GetDocumentsByKeyApiResponse = unknown;
export type GetDocumentsByKeyApiArg = {
  /** A key identifying the document */
  key: number;
};
export type DeleteDocumentsByKeyApiResponse = unknown;
export type DeleteDocumentsByKeyApiArg = {
  /** A key identifying the document */
  key: number;
};
export type PostDocumentsApiResponse = /** status 201 The key of the added document */ {
  document_key?: number;
};
export type PostDocumentsApiArg = void;
export type GetLightRollingStockApiResponse = /** status 200 The rolling stock list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: LightRollingStock[];
};
export type GetLightRollingStockApiArg = {
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type GetLightRollingStockByIdApiResponse =
  /** status 200 The rolling stock without effort curves nor rolling resistance */ LightRollingStock;
export type GetLightRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
};
export type GetRollingStockByIdApiResponse =
  /** status 200 The rolling stock information */ RollingStock;
export type GetRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
};
export type PostProjectsApiResponse = /** status 201 The created project */ ProjectResult;
export type PostProjectsApiArg = {
  projectCreateRequest: ProjectCreateRequest;
};
export type GetProjectsApiResponse = /** status 200 the project list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: {
    schema?: ProjectResult;
  }[];
};
export type GetProjectsApiArg = {
  ordering?:
    | 'name'
    | '-name'
    | 'creation_date'
    | '-creation_date'
    | 'last_modification'
    | '-last_modification';
  /** Filter projects by name */
  name?: string;
  /** Filter projects by description */
  description?: string;
  /** Filter projects by tags */
  tags?: string;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type GetProjectsByProjectIdApiResponse = /** status 200 The project info */ ProjectResult;
export type GetProjectsByProjectIdApiArg = {
  /** project id you want to retrieve */
  projectId: number;
};
export type PatchProjectsByProjectIdApiResponse =
  /** status 200 The project updated */ ProjectResult;
export type PatchProjectsByProjectIdApiArg = {
  /** project id you want to update */
  projectId: number;
  /** The fields you want to update */
  projectPatchRequest: ProjectPatchRequest;
};
export type DeleteProjectsByProjectIdApiResponse = unknown;
export type DeleteProjectsByProjectIdApiArg = {
  /** project id you want to delete */
  projectId: number;
};
export type PostProjectsByProjectIdStudiesApiResponse =
  /** status 201 The created operational study */ StudyResult;
export type PostProjectsByProjectIdStudiesApiArg = {
  projectId: number;
  studyCreateRequest: StudyCreateRequest;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the operational study */
  projectId: number;
  /** study id you want to delete */
  studyId: number;
};
export type GetRollingStockByIdLiveryAndLiveryIdApiResponse = unknown;
export type GetRollingStockByIdLiveryAndLiveryIdApiArg = {
  /** Rolling Stock ID */
  id: number;
  /** Rolling Stock Livery ID */
  liveryId: number;
};
export type SearchQuery = (boolean | number | number | string | SearchQuery)[] | null;
export type ViewMetadata = {
  type?: string;
  name?: string;
  promotedId?: object;
  scheme?: string;
  tiles?: string[];
  attribution?: string;
  minzoom?: number;
  maxzoom?: number;
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
export type Point3D = number[];
export type Point = {
  type: 'Point';
  coordinates: Point3D;
};
export type LineString = {
  type: 'LineString';
  coordinates: Point3D[];
};
export type Polygon = {
  type: 'Polygon';
  coordinates: Point3D[][];
};
export type MultiPoint = {
  type: 'MultiPoint';
  coordinates: Point3D[];
};
export type MultiLineString = {
  type: 'MultiLineString';
  coordinates: Point3D[][];
};
export type MultiPolygon = {
  type: 'MultiPolygon';
  coordinates: Point3D[][][];
};
export type Geometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon;
export type InfraError = {
  geographic?: Geometry | null;
  schematic?: object | null;
  information: {
    obj_id: string;
    obj_type: 'TrackSection' | 'Signal' | 'BufferStop' | 'Detector' | 'Switch' | 'Route';
    error_type:
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
    field?: string;
    is_warning: boolean;
  };
};
export type BoundingBox = number[][];
export type Zone = {
  geo?: BoundingBox;
  sch?: BoundingBox;
};
export type RouteTrackRangesNotFoundError = {
  type?: 'NotFound';
};
export type RouteTrackRangesCantComputePathError = {
  type?: 'CantComputePath';
};
export type Direction = 'START_TO_STOP' | 'STOP_TO_START';
export type DirectionalTrackRange = {
  track?: string;
  begin?: number;
  end?: number;
  direction?: Direction;
};
export type RouteTrackRangesComputed = {
  type?: 'Computed';
  track_ranges?: DirectionalTrackRange[];
};
export type TrackLocation = {
  track?: string;
  offset?: number;
};
export type TrackRange = {
  track?: string;
  begin?: number;
  end?: number;
};
export type ElectricalProfile = {
  value?: string;
  power_class?: string;
  track_ranges?: TrackRange[];
};
export type LightRollingStock = {
  id?: number;
  version?: string;
  name?: string;
  length?: number;
  max_speed?: number;
  startup_time?: number;
  startup_acceleration?: number;
  comfort_acceleration?: number;
  gamma?: {
    type?: 'CONST' | 'MAX';
    value?: number;
  };
  inertia_coefficient?: number;
  features?: string[];
  mass?: number;
  rolling_resistance?: {
    A?: number;
    B?: number;
    C?: number;
    type?: 'davis';
  };
  loading_gauge?: 'G1' | 'G2' | 'GA' | 'GB' | 'GB1' | 'GC' | 'FR3.3' | 'FR3.3/GB/G2' | 'GLOTT';
  effort_curves?: {
    default_mode?: string;
    modes?: {
      [key: string]: {
        is_electric?: boolean;
      };
    };
  };
  base_power_class?: string;
  power_restrictions?: {
    [key: string]: string;
  };
  metadata?: object;
  liveries?: {
    id?: number;
    name?: string;
  }[];
};
export type Comfort = 'AC' | 'HEATING' | 'STANDARD';
export type EffortCurve = {
  speeds?: number[];
  max_efforts?: number[];
};
export type ConditionalEffortCurve = {
  cond?: {
    comfort?: Comfort | null;
    electrical_profile_level?: string | null;
    power_restriction_code?: string | null;
  } | null;
  curve?: EffortCurve;
};
export type RollingStock = LightRollingStock & {
  effort_curves?: {
    default_mode?: string;
    modes?: {
      [key: string]: {
        curves?: ConditionalEffortCurve[];
        default_curve?: EffortCurve;
        is_electric?: boolean;
      };
    };
  };
};
export type ProjectResult = {
  id?: number;
  name?: string;
  objectives?: string;
  description?: string;
  funders?: string[];
  budget?: number;
  image?: number;
  image_url?: string;
  creation_date?: string;
  last_modification?: string;
  studies?: number[];
  tags?: string[];
};
export type ProjectCreateRequest = {
  name: string;
  objectives?: string;
  description?: string;
  funders?: string;
  budget?: number;
  image?: number;
  tags?: string[];
};
export type ProjectPatchRequest = {
  name?: string;
  objectives?: string;
  description?: string;
  funders?: string;
  budget?: number;
  image?: number;
  tags?: string[];
};
export type StudyResult = {
  id?: number;
  name?: string;
  description?: string;
  budget?: number;
  service_code?: string;
  business_code?: string;
  creation_date?: string;
  last_modification?: string;
  scenarios?: number[];
  start_date_study?: string;
  expected_end_date_study?: string;
  actual_end_date_study?: string;
  state?: 'started' | 'inProgress' | 'finish';
  study_type?:
    | 'timeTables'
    | 'flowRate'
    | 'parkSizing'
    | 'garageRequirement'
    | 'operationOrSizing'
    | 'operability'
    | 'strategicPlanning'
    | 'chartStability'
    | 'disturbanceTests';
};
export type StudyCreateRequest = {
  name: string;
  service_code?: string;
  business_code?: string;
  description?: string;
  budget?: number;
  tags?: string[];
  start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;
  state?: 'started' | 'inProgress' | 'finish';
  study_type?:
    | 'timeTables'
    | 'flowRate'
    | 'parkSizing'
    | 'garageRequirement'
    | 'operationOrSizing'
    | 'operability'
    | 'strategicPlanning'
    | 'chartStability'
    | 'disturbanceTests';
};
