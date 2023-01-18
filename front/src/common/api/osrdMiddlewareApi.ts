import { emptySplitApi as api } from './emptyApi';
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
    getTimetable: build.query<GetTimetableApiResponse, GetTimetableApiArg>({
      query: (queryArg) => ({
        url: `/timetable/`,
        params: { infra: queryArg.infra, page: queryArg.page, page_size: queryArg.pageSize },
      }),
    }),
    postTimetable: build.mutation<PostTimetableApiResponse, PostTimetableApiArg>({
      query: (queryArg) => ({ url: `/timetable/`, method: 'POST', body: queryArg.body }),
    }),
    getTimetableById: build.query<GetTimetableByIdApiResponse, GetTimetableByIdApiArg>({
      query: (queryArg) => ({ url: `/timetable/${queryArg.id}/` }),
    }),
    deleteTimetableById: build.mutation<DeleteTimetableByIdApiResponse, DeleteTimetableByIdApiArg>({
      query: (queryArg) => ({ url: `/timetable/${queryArg.id}/`, method: 'DELETE' }),
    }),
    putTimetableById: build.mutation<PutTimetableByIdApiResponse, PutTimetableByIdApiArg>({
      query: (queryArg) => ({
        url: `/timetable/${queryArg.id}/`,
        method: 'PUT',
        body: queryArg.body,
      }),
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
        params: { path: queryArg.path, train_ids: queryArg.trainIds },
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
export type PostPathfindingApiResponse = /** status 201 The path */ Path[];
export type PostPathfindingApiArg = {
  /** Steps of the path */
  pathQuery: PathQuery;
};
export type PostPathfindingOpApiResponse = /** status 201 The path */ Path[];
export type PostPathfindingOpApiArg = {
  /** Steps of the path */
  pathOpQuery: PathOpQuery;
};
export type GetPathfindingByIdApiResponse = /** status 200 The path */ Path[];
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
export type GetTimetableApiResponse = /** status 200 The timetable list */ {
  count?: number;
  next?: any;
  previous?: any;
  results?: {
    id?: number;
    name?: string;
    infra?: number;
  }[];
};
export type GetTimetableApiArg = {
  /** Filter timetable by infra */
  infra?: number;
  /** Page number */
  page?: number;
  /** Number of elements by page */
  pageSize?: number;
};
export type PostTimetableApiResponse = /** status 201 The timetable created */ {
  id?: number;
  name?: string;
  infra?: number;
};
export type PostTimetableApiArg = {
  /** Infrastructure id and waypoints */
  body: {
    infra?: number;
    name?: string;
  };
};
export type GetTimetableByIdApiResponse = /** status 200 The timetable content */ {
  id?: number;
  name?: string;
  infra?: number;
  train_schedule?: {
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
export type DeleteTimetableByIdApiResponse = unknown;
export type DeleteTimetableByIdApiArg = {
  /** Timetable ID */
  id: number;
};
export type PutTimetableByIdApiResponse = /** status 200 The timetable updated */ {
  id?: number;
  name?: string;
  infra?: number;
};
export type PutTimetableByIdApiArg = {
  /** Timetable ID */
  id: number;
  /** Infrastructure id and waypoints */
  body: {
    infra?: number;
    name?: string;
  };
};
export type PostTrainScheduleStandaloneSimulationApiResponse =
  /** status 201 The id of the train_schedule created */ {
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
  path?: number;
  /** List of train schedule ids */
  trainIds: number[];
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
export type PostStdcmApiResponse = /** status 200 Simulation result */
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
  geographic?: object;
  schematic?: object;
  slopes?: {
    gradient?: number;
    position?: number;
  }[];
  curves?: {
    radius?: number;
    position?: number;
  }[];
  steps?: {
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
  metadata?: object;
};
export type Comfort = 'AC' | 'HEATING' | 'STANDARD';
export type EffortCurve = {
  speeds?: number[];
  max_efforts?: number[];
};
export type ConditionalEffortCurve = {
  cond?: {
    comfort?: Comfort;
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
    speed_limit_composition?: string;
    comfort?: Comfort;
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
  route_begin_occupancy?: {
    time?: number;
    position?: number;
  }[][];
  route_end_occupancy?: {
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
  mechanical_energy_consumed?: any;
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
};
export type StdcmRequest = {
  infra?: number;
  rolling_stock?: number;
  comfort?: Comfort;
  timetable?: number;
  start_time?: number;
  end_time?: number;
  start_points?: Waypoint[];
  end_points?: Waypoint[];
  maximum_departure_delay?: number;
  maximum_relative_run_time?: number;
  speed_limit_composition?: string;
  margin_before?: number;
  margin_after?: number;
  standard_allowance?: AllowanceValue;
};
