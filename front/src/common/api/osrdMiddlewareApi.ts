import { baseApi as api } from './emptyApi';

const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<GetHealthApiResponse, GetHealthApiArg>({
      query: () => ({ url: `/health/` }),
    }),
    getInfra: build.query<GetInfraApiResponse, GetInfraApiArg>({
      query: () => ({ url: `/infra/` }),
    }),
    getVersionApi: build.query<GetVersionApiApiResponse, GetVersionApiApiArg>({
      query: () => ({ url: `/version/api/` }),
    }),
    getVersionCore: build.query<GetVersionCoreApiResponse, GetVersionCoreApiArg>({
      query: () => ({ url: `/version/core/` }),
    }),
    getInfraById: build.query<GetInfraByIdApiResponse, GetInfraByIdApiArg>({
      query: (queryArg) => ({ url: `/infra/${queryArg.id}/` }),
    }),
    postInfraRailjson: build.mutation<PostInfraRailjsonApiResponse, PostInfraRailjsonApiArg>({
      query: (queryArg) => ({ url: `/infra/railjson/`, method: 'POST', body: queryArg.body }),
    }),
    getInfraByIdRailjson: build.query<GetInfraByIdRailjsonApiResponse, GetInfraByIdRailjsonApiArg>({
      query: (queryArg) => ({
        url: `/infra/${queryArg.id}/railjson/`,
        params: { exclude_extensions: queryArg.excludeExtensions },
      }),
    }),
    postPathfinding: build.mutation<PostPathfindingApiResponse, PostPathfindingApiArg>({
      query: (queryArg) => ({ url: `/pathfinding/`, method: 'POST', body: queryArg.pathQuery }),
    }),
    postPathfindingOp: build.mutation<PostPathfindingOpApiResponse, PostPathfindingOpApiArg>({
      query: (queryArg) => ({
        url: `/pathfinding/op/`,
        method: 'POST',
        body: queryArg.pathOpQuery,
      }),
    }),
    getPathfindingById: build.query<GetPathfindingByIdApiResponse, GetPathfindingByIdApiArg>({
      query: (queryArg) => ({ url: `/pathfinding/${queryArg.id}/` }),
    }),
    putPathfindingById: build.mutation<PutPathfindingByIdApiResponse, PutPathfindingByIdApiArg>({
      query: (queryArg) => ({
        url: `/pathfinding/${queryArg.id}/`,
        method: 'PUT',
        body: queryArg.pathQuery,
      }),
    }),
    deletePathfindingById: build.mutation<
      DeletePathfindingByIdApiResponse,
      DeletePathfindingByIdApiArg
    >({
      query: (queryArg) => ({ url: `/pathfinding/${queryArg.id}/`, method: 'DELETE' }),
    }),
    getRollingStock: build.query<GetRollingStockApiResponse, GetRollingStockApiArg>({
      query: (queryArg) => ({
        url: `/rolling_stock/`,
        params: { page: queryArg.page, page_size: queryArg.pageSize },
      }),
    }),
    postRollingStock: build.mutation<PostRollingStockApiResponse, PostRollingStockApiArg>({
      query: () => ({ url: `/rolling_stock/`, method: 'POST' }),
    }),
    getRollingStockById: build.query<GetRollingStockByIdApiResponse, GetRollingStockByIdApiArg>({
      query: (queryArg) => ({ url: `/rolling_stock/${queryArg.id}/` }),
    }),
    getRollingStockByIdLivery: build.query<
      GetRollingStockByIdLiveryApiResponse,
      GetRollingStockByIdLiveryApiArg
    >({
      query: (queryArg) => ({
        url: `/rolling_stock/${queryArg.id}/livery/`,
        params: { livery_id: queryArg.liveryId },
      }),
    }),
    postRollingStockLivery: build.mutation<
      PostRollingStockLiveryApiResponse,
      PostRollingStockLiveryApiArg
    >({
      query: (queryArg) => ({ url: `/rolling_stock_livery/`, method: 'POST', body: queryArg.body }),
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
    getTimetableById: build.query<GetTimetableByIdApiResponse, GetTimetableByIdApiArg>({
      query: (queryArg) => ({ url: `/timetable/${queryArg.id}/` }),
    }),
    postTrainScheduleStandaloneSimulation: build.mutation<
      PostTrainScheduleStandaloneSimulationApiResponse,
      PostTrainScheduleStandaloneSimulationApiArg
    >({
      query: (queryArg) => ({
        url: `/train_schedule/standalone_simulation/`,
        method: 'POST',
        body: queryArg.standaloneSimulationParameters,
      }),
    }),
    getTrainScheduleById: build.query<GetTrainScheduleByIdApiResponse, GetTrainScheduleByIdApiArg>({
      query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/` }),
    }),
    deleteTrainScheduleById: build.mutation<
      DeleteTrainScheduleByIdApiResponse,
      DeleteTrainScheduleByIdApiArg
    >({
      query: (queryArg) => ({ url: `/train_schedule/${queryArg.id}/`, method: 'DELETE' }),
    }),
    patchTrainScheduleById: build.mutation<
      PatchTrainScheduleByIdApiResponse,
      PatchTrainScheduleByIdApiArg
    >({
      query: (queryArg) => ({
        url: `/train_schedule/${queryArg.id}/`,
        method: 'PATCH',
        body: queryArg.writableTrainSchedule,
      }),
    }),
    getTrainScheduleByIdResult: build.query<
      GetTrainScheduleByIdResultApiResponse,
      GetTrainScheduleByIdResultApiArg
    >({
      query: (queryArg) => ({
        url: `/train_schedule/${queryArg.id}/result/`,
        params: { path: queryArg.path },
      }),
    }),
    getTrainScheduleResults: build.query<
      GetTrainScheduleResultsApiResponse,
      GetTrainScheduleResultsApiArg
    >({
      query: (queryArg) => ({
        url: `/train_schedule/results/`,
        params: { path_id: queryArg.pathId, timetable_id: queryArg.timetableId },
      }),
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
    getInfraSchema: build.query<GetInfraSchemaApiResponse, GetInfraSchemaApiArg>({
      query: () => ({ url: `/infra/schema/` }),
    }),
    postStdcm: build.mutation<PostStdcmApiResponse, PostStdcmApiArg>({
      query: (queryArg) => ({ url: `/stdcm/`, method: 'POST', body: queryArg.stdcmRequest }),
    }),
    postProjects: build.mutation<PostProjectsApiResponse, PostProjectsApiArg>({
      query: (queryArg) => ({ url: `/projects/`, method: 'POST', body: queryArg.projectRequest }),
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
        body: queryArg.projectRequest,
      }),
    }),
    deleteProjectsByProjectId: build.mutation<
      DeleteProjectsByProjectIdApiResponse,
      DeleteProjectsByProjectIdApiArg
    >({
      query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/`, method: 'DELETE' }),
    }),
    getProjectsByProjectIdImage: build.query<
      GetProjectsByProjectIdImageApiResponse,
      GetProjectsByProjectIdImageApiArg
    >({
      query: (queryArg) => ({ url: `/projects/${queryArg.projectId}/image/` }),
    }),
    postProjectsByProjectIdStudies: build.mutation<
      PostProjectsByProjectIdStudiesApiResponse,
      PostProjectsByProjectIdStudiesApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/`,
        method: 'POST',
        body: queryArg.studyRequest,
      }),
    }),
    getProjectsByProjectIdStudies: build.query<
      GetProjectsByProjectIdStudiesApiResponse,
      GetProjectsByProjectIdStudiesApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/`,
        params: {
          name: queryArg.name,
          description: queryArg.description,
          tags: queryArg.tags,
          page: queryArg.page,
          page_size: queryArg.pageSize,
        },
      }),
    }),
    getProjectsByProjectIdStudiesAndStudyId: build.query<
      GetProjectsByProjectIdStudiesAndStudyIdApiResponse,
      GetProjectsByProjectIdStudiesAndStudyIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
      }),
    }),
    patchProjectsByProjectIdStudiesAndStudyId: build.mutation<
      PatchProjectsByProjectIdStudiesAndStudyIdApiResponse,
      PatchProjectsByProjectIdStudiesAndStudyIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/`,
        method: 'PATCH',
        body: queryArg.studyRequest,
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
    getProjectsStudyTypes: build.query<
      GetProjectsStudyTypesApiResponse,
      GetProjectsStudyTypesApiArg
    >({
      query: () => ({ url: `/projects/study_types/` }),
    }),
    getProjectsStudyStates: build.query<
      GetProjectsStudyStatesApiResponse,
      GetProjectsStudyStatesApiArg
    >({
      query: () => ({ url: `/projects/study_states/` }),
    }),
    postProjectsByProjectIdStudiesAndStudyIdScenarios: build.mutation<
      PostProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
      PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
        method: 'POST',
        body: queryArg.scenarioRequest,
      }),
    }),
    getProjectsByProjectIdStudiesAndStudyIdScenarios: build.query<
      GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse,
      GetProjectsByProjectIdStudiesAndStudyIdScenariosApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/`,
        params: {
          name: queryArg.name,
          description: queryArg.description,
          tags: queryArg.tags,
          page: queryArg.page,
          page_size: queryArg.pageSize,
        },
      }),
    }),
    getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.query<
      GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
      GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
      }),
    }),
    patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
      PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
      PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        method: 'PATCH',
        body: queryArg.scenarioRequest,
      }),
    }),
    deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId: build.mutation<
      DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse,
      DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg
    >({
      query: (queryArg) => ({
        url: `/projects/${queryArg.projectId}/studies/${queryArg.studyId}/scenarios/${queryArg.scenarioId}/`,
        method: 'DELETE',
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as osrdMiddlewareApi };
export type GetHealthApiResponse = unknown;
export type GetHealthApiArg = void;
export type GetInfraApiResponse = /** status 200 The infra list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: Infra[];
};
export type GetInfraApiArg = void;
export type GetVersionApiApiResponse = /** status 200 Return the api service version */ {
  git_describe: string | null;
};
export type GetVersionApiApiArg = void;
export type GetVersionCoreApiResponse = /** status 200 Return the core service version */ {
  git_describe: string | null;
};
export type GetVersionCoreApiArg = void;
export type GetInfraByIdApiResponse = /** status 200 The infra information */ Infra;
export type GetInfraByIdApiArg = {
  /** Infra ID */
  id: number;
};
export type PostInfraRailjsonApiResponse = /** status 201 The imported infra id */ {
  id?: string;
};
export type PostInfraRailjsonApiArg = {
  /** Railjson infra */
  body: object;
};
export type GetInfraByIdRailjsonApiResponse = /** status 200 The infra in railjson format */ object;
export type GetInfraByIdRailjsonApiArg = {
  /** Infra ID */
  id: number;
  /** Whether the railjson should contain extensions */
  excludeExtensions?: boolean;
};
export type PostPathfindingApiResponse = /** status 201 The path */ Path;
export type PostPathfindingApiArg = {
  /** Steps of the path */
  pathQuery: PathQuery;
};
export type PostPathfindingOpApiResponse = /** status 201 The path */ Path[];
export type PostPathfindingOpApiArg = {
  /** Steps of the path */
  pathOpQuery: PathOpQuery;
};
export type GetPathfindingByIdApiResponse = /** status 200 The path */ Path;
export type GetPathfindingByIdApiArg = {
  /** Path ID */
  id: number;
};
export type PutPathfindingByIdApiResponse = /** status 200 The path */ Path[];
export type PutPathfindingByIdApiArg = {
  /** Path ID */
  id: number;
  /** Steps of the path */
  pathQuery: PathQuery;
};
export type DeletePathfindingByIdApiResponse = unknown;
export type DeletePathfindingByIdApiArg = {
  /** Path ID */
  id: number;
};
export type GetRollingStockApiResponse = /** status 200 The rolling stock list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: RollingStock[];
};
export type GetRollingStockApiArg = {
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostRollingStockApiResponse = /** status 200 The rolling stock list */ RollingStock;
export type PostRollingStockApiArg = void;
export type GetRollingStockByIdApiResponse =
  /** status 200 The rolling stock information */ RollingStock;
export type GetRollingStockByIdApiArg = {
  /** Rolling Stock ID */
  id: number;
};
export type GetRollingStockByIdLiveryApiResponse = unknown;
export type GetRollingStockByIdLiveryApiArg = {
  /** Rolling Stock ID */
  id: number;
  /** Rolling Stock Livery ID */
  liveryId: number;
};
export type PostRollingStockLiveryApiResponse = unknown;
export type PostRollingStockLiveryApiArg = {
  body: {
    name?: string;
    rolling_stock_id?: number;
    images?: Blob[];
  };
};
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
export type GetTimetableByIdApiResponse = /** status 200 The timetable content */ {
  id?: number;
  name?: string;
  train_schedules?: {
    id?: number;
    train_name?: string;
    departure_time?: number;
    train_path?: number;
  }[];
};
export type GetTimetableByIdApiArg = {
  /** Timetable ID */
  id: number;
};
export type PostTrainScheduleStandaloneSimulationApiResponse =
  /** status 201 The ids of the train_schedules created */ {
    ids?: number[];
  };
export type PostTrainScheduleStandaloneSimulationApiArg = {
  /** Standalone simulation parameters */
  standaloneSimulationParameters: StandaloneSimulationParameters;
};
export type GetTrainScheduleByIdApiResponse =
  /** status 200 The train schedule info */ TrainSchedule;
export type GetTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
};
export type DeleteTrainScheduleByIdApiResponse = unknown;
export type DeleteTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
};
export type PatchTrainScheduleByIdApiResponse =
  /** status 200 The train schedule info */ TrainSchedule;
export type PatchTrainScheduleByIdApiArg = {
  /** Train schedule ID */
  id: number;
  /** Train schedule fields */
  writableTrainSchedule: WritableTrainSchedule;
};
export type GetTrainScheduleByIdResultApiResponse =
  /** status 200 The train schedule result */ TrainScheduleResult;
export type GetTrainScheduleByIdResultApiArg = {
  /** Train schedule ID */
  id: number;
  /** Path id used to project the train path */
  path?: number;
};
export type GetTrainScheduleResultsApiResponse =
  /** status 200 The train schedules results */ TrainScheduleResult[];
export type GetTrainScheduleResultsApiArg = {
  /** Path id used to project the train path */
  pathId?: number;
  /** Timetable id of the simulation */
  timetableId: number;
};
export type GetInfraByIdSpeedLimitTagsApiResponse = /** status 200 Tags list */ string[];
export type GetInfraByIdSpeedLimitTagsApiArg = {
  /** Infra ID */
  id: number;
};
export type GetInfraByIdVoltagesApiResponse = /** status 200 Voltages list */ number[];
export type GetInfraByIdVoltagesApiArg = {
  /** Infra ID */
  id: number;
};
export type GetInfraSchemaApiResponse = /** status 200 Json schema */ object;
export type GetInfraSchemaApiArg = void;
export type PostStdcmApiResponse =
  /** status 200 Simulation result */
  | {
      simulation?: TrainScheduleResult;
      path?: Path;
    }
  | {
      error?: string;
    };
export type PostStdcmApiArg = {
  stdcmRequest: StdcmRequest;
};
export type PostProjectsApiResponse = /** status 201 The created project */ ProjectResult;
export type PostProjectsApiArg = {
  projectRequest: ProjectRequest;
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
  projectRequest: ProjectRequest;
};
export type DeleteProjectsByProjectIdApiResponse = unknown;
export type DeleteProjectsByProjectIdApiArg = {
  /** project id you want to delete */
  projectId: number;
};
export type GetProjectsByProjectIdImageApiResponse = unknown;
export type GetProjectsByProjectIdImageApiArg = {
  /** project id you want to retrieve the image */
  projectId: number;
};
export type PostProjectsByProjectIdStudiesApiResponse =
  /** status 201 The created operational study */ StudyResult;
export type PostProjectsByProjectIdStudiesApiArg = {
  projectId: number;
  studyRequest: StudyRequest;
};
export type GetProjectsByProjectIdStudiesApiResponse = /** status 200 the studies list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: {
    schema?: StudyResult;
  }[];
};
export type GetProjectsByProjectIdStudiesApiArg = {
  projectId: number;
  /** Filter operational studies by name */
  name?: string;
  /** Filter operational studies by description */
  description?: string;
  /** Filter operational studies by tags */
  tags?: string;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The operational study info */ StudyResult;
export type GetProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the operational study */
  projectId: number;
  /** study id you want to retrieve */
  studyId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdApiResponse =
  /** status 200 The operational study updated */ StudyResult;
export type PatchProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the study */
  projectId: number;
  /** study id you want to retrieve */
  studyId: number;
  /** The fields you want to update */
  studyRequest: StudyRequest;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdApiArg = {
  /** project id refered to the operational study */
  projectId: number;
  /** study id you want to delete */
  studyId: number;
};
export type GetProjectsStudyTypesApiResponse = /** status 200 The list of study types */ string[];
export type GetProjectsStudyTypesApiArg = void;
export type GetProjectsStudyStatesApiResponse = /** status 200 The list of study states */ string[];
export type GetProjectsStudyStatesApiArg = void;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 201 The created scenario */ ScenarioResult;
export type PostProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  projectId: number;
  studyId: number;
  scenarioRequest: ScenarioRequest;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiResponse =
  /** status 200 list of scenarios */ {
    count?: number;
    next?: any;
    previous?: any;
    results?: {
      schema?: ScenarioResult;
    }[];
  };
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosApiArg = {
  projectId: number;
  studyId: number;
  /** Filter scenarios by name */
  name?: string;
  /** Filter scenarios by description */
  description?: string;
  /** Filter scenarios by tags */
  tags?: string;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The operational study info */ ScenarioResult;
export type GetProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  studyId: number;
  /** scenario id you want to retrieve */
  scenarioId: number;
};
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse =
  /** status 200 The scenario updated */ ScenarioResult;
export type PatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  /** study refered to the scenario */
  studyId: number;
  /** scenario you want to update */
  scenarioId: number;
  /** The fields you want to update */
  scenarioRequest: ScenarioRequest;
};
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiResponse = unknown;
export type DeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdApiArg = {
  /** project id refered to the scenario */
  projectId: number;
  /** study id refered to the scenario */
  studyId: number;
  /** scenario id you want to delete */
  scenarioId: number;
};
export type Infra = {
  id?: number;
  name?: string;
  owner?: string;
  created?: string;
  modified?: string;
};
export type Path = {
  id?: number;
  owner?: string;
  created?: string;
  geographic?: {
    coordinates?: number[][];
    type?: string;
  };
  schematic?: {
    coordinates?: number[][];
    type?: string;
  };
  slopes?: {
    gradient?: number;
    position?: number;
  }[];
  curves?: {
    radius?: number;
    position?: number;
  }[];
  steps?: {
    id?: string;
    name?: string;
    suggestion?: boolean;
    duration?: number;
    track?: string;
    position?: number;
    sch?: {
      coordinates?: number[];
      type?: string;
    };
    geo?: {
      coordinates?: number[];
      type?: string;
    };
  }[];
};
export type Waypoint = {
  track_section?: string;
  geo_coordinate?: number[];
}[];
export type PathQuery = {
  infra?: number;
  rolling_stocks?: number[];
  steps?: {
    duration?: number;
    waypoints?: Waypoint;
  }[];
};
export type PathOpQuery = {
  infra?: number;
  rolling_stocks?: number[];
  steps?: {
    duration?: number;
    op_trigram?: string;
  }[];
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
export type AllowanceTimePerDistanceValue = {
  value_type?: 'time_per_distance';
  minutes?: number;
};
export type AllowanceTimeValue = {
  value_type?: 'time';
  seconds?: number;
};
export type AllowancePercentValue = {
  value_type?: 'percentage';
  percentage?: number;
};
export type AllowanceValue =
  | ({
      value_type: 'AllowanceTimePerDistanceValue';
    } & AllowanceTimePerDistanceValue)
  | ({
      value_type: 'AllowanceTimeValue';
    } & AllowanceTimeValue)
  | ({
      value_type: 'AllowancePercentValue';
    } & AllowancePercentValue);
export type RangeAllowance = {
  begin_position?: number;
  end_position?: number;
  value?: AllowanceValue;
};
export type EngineeringAllowance = {
  allowance_type?: 'engineering';
  distribution?: 'MARECO' | 'LINEAR';
  capacity_speed_limit?: number;
} & RangeAllowance;
export type StandardAllowance = {
  allowance_type?: 'standard';
  default_value?: AllowanceValue;
  ranges?: RangeAllowance[];
  distribution?: 'MARECO' | 'LINEAR';
  capacity_speed_limit?: number;
};
export type Allowance =
  | ({
      allowance_type: 'EngineeringAllowance';
    } & EngineeringAllowance)
  | ({
      allowance_type: 'StandardAllowance';
    } & StandardAllowance);
export type PowerRestrictionRange = {
  begin_position?: number;
  end_position?: number;
  power_restriction_code?: string;
};
export type TrainScheduleOptions = {
  ignore_electrical_profiles?: boolean | null;
};
export type StandaloneSimulationParameters = {
  timetable?: number;
  path?: number;
  schedules?: {
    train_name?: string;
    rolling_stock?: number;
    departure_time?: number;
    initial_speed?: number;
    labels?: string[];
    allowances?: Allowance[];
    speed_limit_tags?: string;
    comfort?: Comfort;
    power_restriction_ranges?: PowerRestrictionRange[] | null;
    options?: TrainScheduleOptions | null;
  }[];
};
export type WritableTrainSchedule = {
  train_name?: string;
  timetable?: number;
  rolling_stock?: number;
  departure_time?: number;
  path?: number;
  initial_speed?: number;
  labels?: string[];
  allowances?: Allowance[];
  speed_limit_tags?: string;
  comfort?: Comfort;
  options?: TrainScheduleOptions | null;
};
export type TrainSchedule = {
  id?: number;
} & WritableTrainSchedule;
export type TrainScheduleResultData = {
  speeds?: {
    time?: number;
    position?: number;
    speed?: number;
  }[];
  head_positions?: {
    time?: number;
    position?: number;
  }[][];
  tail_positions?: {
    time?: number;
    position?: number;
  }[][];
  stops?: {
    id?: number;
    name?: string;
    time?: number;
    position?: number;
    duration?: number;
    line_code?: number;
    track_number?: number;
    line_name?: string;
    track_name?: string;
  }[];
  route_aspects?: {
    signal_id?: string;
    route_id?: string;
    time_start?: number;
    time_end?: number;
    position_start?: number;
    position_end?: number;
    color?: number;
    blinking?: boolean;
    aspect_label?: string;
  }[];
  signals?: {
    signal_id?: number;
    aspects?: string[];
    geo_position?: number[];
    schema_position?: number[];
  }[];
  mechanical_energy_consumed?: number;
};
export type TrainScheduleResult = {
  id?: number;
  name?: string;
  labels?: string[];
  path?: number;
  vmax?: {
    position?: number;
    speed?: number;
  }[];
  slopes?: {
    position?: number;
    gradient?: number;
  }[];
  curves?: {
    position?: number;
    radius?: number;
  }[];
  base?: TrainScheduleResultData;
  eco?:
    | TrainScheduleResultData
    | {
        error?: string;
      };
  electrification_conditions?: {
    start?: number;
    stop?: number;
    mode_used?: string;
    profile_used?: string | null;
    restriction_used?: string | null;
    mode_seen?: string | null;
    profile_seen?: string | null;
    restriction_seen?: string | null;
  }[][];
};
export type StdcmRequest = {
  infra?: number;
  rolling_stock?: number;
  comfort?: Comfort;
  timetable?: number;
  start_time?: number;
  end_time?: number;
  steps?: {
    duration?: number;
    waypoints?: Waypoint;
  }[];
  maximum_departure_delay?: number;
  maximum_relative_run_time?: number;
  speed_limit_tags?: string;
  margin_before?: number;
  margin_after?: number;
  standard_allowance?: AllowanceValue;
};
export type ProjectResult = {
  id?: number;
  name?: string;
  objectives?: string;
  description?: string;
  funders?: string;
  budget?: number;
  image_url?: string;
  creation_date?: string;
  last_modification?: string;
  studies?: number[];
  tags?: string[];
};
export type ProjectRequest = {
  name: string;
  objectives?: string;
  description?: string;
  funders?: string;
  budget?: number;
  image?: object;
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
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
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
export type StudyRequest = {
  name: string;
  service_code?: string;
  business_code?: string;
  description?: string;
  budget?: number;
  tags?: string[];
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
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
export type ScenarioResult = {
  id?: number;
  name?: string;
  description?: string[];
  tags?: string[];
  infra?: number;
  infra_name?: string;
  electrical_profile_set?: number | null;
  electrical_profile_set_name?: string | null;
  creation_date?: string;
  last_modification?: string;
  timetable?: number;
  trains_count?: number;
  trains_schedules?: string[];
};
export type ScenarioRequest = {
  name: string;
  description?: string;
  tags?: string[];
  infra?: number;
  electrical_profile_set?: number | null;
};
