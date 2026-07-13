import { baseRailwayManagerApi as api } from './baseGeneratedApis';
export const addTagTypes = ['timetable', 'lmr'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      postTransformTimetable: build.mutation<
        PostTransformTimetableApiResponse,
        PostTransformTimetableApiArg
      >({
        query: (queryArg) => ({
          url: `/transform_timetable`,
          method: 'POST',
          body: queryArg.body,
          headers: {
            'content-encoding': queryArg['content-encoding'],
          },
        }),
        invalidatesTags: ['timetable'],
      }),
      getSendLastMinuteRequestAuthorized: build.query<
        GetSendLastMinuteRequestAuthorizedApiResponse,
        GetSendLastMinuteRequestAuthorizedApiArg
      >({
        query: () => ({ url: `/send_last_minute_request/authorized` }),
        providesTags: ['lmr'],
      }),
      getSendLastMinuteRequestFolderUrl: build.query<
        GetSendLastMinuteRequestFolderUrlApiResponse,
        GetSendLastMinuteRequestFolderUrlApiArg
      >({
        query: () => ({ url: `/send_last_minute_request/folder_url` }),
        providesTags: ['lmr'],
      }),
      postSendLastMinuteRequest: build.mutation<
        PostSendLastMinuteRequestApiResponse,
        PostSendLastMinuteRequestApiArg
      >({
        query: (queryArg) => ({
          url: `/send_last_minute_request`,
          method: 'POST',
          body: queryArg.body,
        }),
        invalidatesTags: ['lmr'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as osrdRailwayManagerApi };
export type PostTransformTimetableApiResponse =
  /** status 200 Timetable successfully transformed */ TransformTimetableResponse;
export type PostTransformTimetableApiArg = {
  /** Compression method used for the request body */
  'content-encoding'?: 'gzip' | 'zip';
  /** Arbitrary file to transform into a standard OSRD timetable json file */
  body: Blob;
};
export type GetSendLastMinuteRequestAuthorizedApiResponse =
  /** status 200 Authorization result */ {
    /** Whether the user is authenticated and authorized to send last-minute requests */
    authorized: boolean;
  };
export type GetSendLastMinuteRequestAuthorizedApiArg = void;
export type GetSendLastMinuteRequestFolderUrlApiResponse =
  /** status 200 The URL where the logged in user can find the requests they sent */ {
    /** The url of the folder */
    url: string;
  };
export type GetSendLastMinuteRequestFolderUrlApiArg = void;
export type PostSendLastMinuteRequestApiResponse =
  /** status 200 User successfully identified, the last-minute request has been formatted and transferred. */ SendLastMinuteRequestResponse;
export type PostSendLastMinuteRequestApiArg = {
  body: {
    simulation_report: SimulationReport;
    simulation_report_sheet: Blob;
  };
};
export type ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1 =
  string;
export type ConstraintDistribution = 'STANDARD' | 'MARECO';
export type Options = {
  stops_at_end_of_block?: boolean;
  use_electrical_profiles?: boolean;
  use_speed_limits_for_simulation?: boolean;
};
export type Margins = {
  boundaries: string[];
  /** The values of the margins. Must contains one more element than the boundaries
    Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
  values: string[];
};
export type Items = {
  /** The unique identifier of the path item.
    This is used to reference path items in the train schedule. */
  key: string;
  /** The location of a path waypoint */
  location:
    | ({
        /** Offset in mm */
        offset: number;
        /** Track section identifier */
        track: string;
      } & {
        type: 'track_offset';
      })
    | ({
        local_track_name?: null | string;
        operational_point:
          | {
              /** The object id of an operational point */
              operational_point: string;
              type: 'id';
            }
          | {
              country_code: string;
              /** The operational point main code */
              main_code: string;
              /** An optional secondary code to identify a more specific location */
              secondary_code?: null | string;
              type: 'domestic';
            }
          | {
              /** An optional secondary code to identify a more specific location */
              secondary_code?: null | string;
              type: 'uic';
              /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
              uic: number;
            };
      } & {
        type: 'operational_point_part_reference';
      });
};
export type Items2 = {
  arrival?: null | ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
  /** Position on the path of the schedule item. */
  at: string;
  /** State of the signal where the train is received for its stop.
    For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>. */
  reception_signal?: 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
  reference_base_arrival?: null | string;
  reference_position?: number | null;
  stop_for?: null | ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
};
export type Comfort = 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
export type ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesCategoryOneOf1 =
    | {
        main_category:
          | 'HIGH_SPEED_TRAIN'
          | 'INTERCITY_TRAIN'
          | 'REGIONAL_TRAIN'
          | 'NIGHT_TRAIN'
          | 'COMMUTER_TRAIN'
          | 'FREIGHT_TRAIN'
          | 'FAST_FREIGHT_TRAIN'
          | 'TRAM_TRAIN'
          | 'TOURISTIC_TRAIN'
          | 'WORK_TRAIN';
      }
    | {
        sub_category_code: string;
      };
export type TransformTimetableResponse = {
  /** List of paced trains */
  paced_trains: ({
    category?:
      | null
      | (
          | {
              main_category:
                | 'HIGH_SPEED_TRAIN'
                | 'INTERCITY_TRAIN'
                | 'REGIONAL_TRAIN'
                | 'NIGHT_TRAIN'
                | 'COMMUTER_TRAIN'
                | 'FREIGHT_TRAIN'
                | 'FAST_FREIGHT_TRAIN'
                | 'TRAM_TRAIN'
                | 'TOURISTIC_TRAIN'
                | 'WORK_TRAIN';
            }
          | {
              sub_category_code: string;
            }
        );
    comfort?: 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
    constraint_distribution: 'STANDARD' | 'MARECO';
    initial_speed?: number;
    labels?: string[];
    margins?: {
      boundaries: string[];
      /** The values of the margins. Must contains one more element than the boundaries
            Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
      values: string[];
    };
    options?: {
      stops_at_end_of_block?: boolean;
      use_electrical_profiles?: boolean;
      use_speed_limits_for_simulation?: boolean;
    };
    path: {
      /** The unique identifier of the path item.
            This is used to reference path items in the train schedule. */
      key: string;
      /** The location of a path waypoint */
      location:
        | ({
            /** Offset in mm */
            offset: number;
            /** Track section identifier */
            track: string;
          } & {
            type: 'track_offset';
          })
        | ({
            local_track_name?: null | string;
            operational_point:
              | {
                  /** The object id of an operational point */
                  operational_point: string;
                  type: 'id';
                }
              | {
                  country_code: string;
                  /** The operational point main code */
                  main_code: string;
                  /** An optional secondary code to identify a more specific location */
                  secondary_code?: null | string;
                  type: 'domestic';
                }
              | {
                  /** An optional secondary code to identify a more specific location */
                  secondary_code?: null | string;
                  type: 'uic';
                  /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
                  uic: number;
                };
          } & {
            type: 'operational_point_part_reference';
          });
    }[];
    power_restrictions?: {
      from: string;
      to: string;
      value: string;
    }[];
    rolling_stock_name: string;
    schedule?: {
      arrival?: null | ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
      /** Position on the path of the schedule item. */
      at: string;
      /** State of the signal where the train is received for its stop.
            For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>. */
      reception_signal?: 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
      reference_base_arrival?: null | string;
      reference_position?: number | null;
      stop_for?: null | ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
    }[];
    speed_limit_tag?: null | string;
    /** For calendar timetables: elapsed ms since 1970-01-01T00:00:00Z.
        For hourly timetables: elapsed ms since the timetable start. */
    start_time: number;
    train_name: string;
  } & {
    paced?: null | {
      exceptions: ({
        occurrence_index?: number;
      } & {
        constraint_distribution?: {
          value: ConstraintDistribution;
        };
        initial_speed?: {
          value: number;
        };
        labels?: {
          value: string[];
        };
        options?: {
          value: Options;
        };
        path_and_schedule?: {
          margins: Margins;
          path: Items[];
          power_restrictions: {
            from: string;
            to: string;
            value: string;
          }[];
          schedule: Items2[];
        };
        rolling_stock?: {
          comfort: Comfort;
          rolling_stock_name: string;
        };
        rolling_stock_category?: {
          value?: null | ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesCategoryOneOf1;
        };
        speed_limit_tag?: {
          value?: null | string;
        };
        start_time?: {
          /** For calendar timetables: elapsed ms since 1970-01-01T00:00:00Z.
                    For hourly timetables: elapsed ms since the timetable start. */
          value: number;
        };
        train_name?: {
          value: string;
        };
      } & {
        disabled?: boolean;
        /** TODO The new exception table id (for incremental migration) */
        id?: number | null;
        /** Unique key for the exception within the paced train, required and generated by the frontend. */
        key: string;
      })[];
      /** Time between two occurrences, an ISO 8601 format is expected */
      interval: ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
      /** Duration of the paced train, an ISO 8601 format is expected */
      time_window: ComponentsSchemasTransformTimetableResponsePropertiesPacedTrainsItemsAllOf0PropertiesScheduleItemsPropertiesReferenceBaseArrivalOneOf1;
    };
  })[];
};
export type ErrorResponse = {
  /** Error message describing what went wrong */
  detail: string;
};
export type SendLastMinuteRequestResponse = {
  status: string;
  message: string;
  request_identifier: string;
  created_request_url: string | null;
};
export type RmiLoadingGaugeType = 'GA' | 'GB';
export type SimulatedStep = {
  /** The offset in ms from the beginning of the simulation at which the step is reached. */
  path_item_time: number;
  /** The offset in mm from the beginning of the simulation at which the step is reached. */
  path_item_position: number;
  /** The identifier of the operational point reached at this step */
  op_id: string;
  /** The duration in ms if a stop occurs at this operational point */
  stop_for?: number | null;
};
export type ConsistChange = {
  rolling_stock: string;
  towed_rolling_stock?: string | null;
  /** Total mass of the train in kg */
  total_mass: number;
  /** Total length of the train in m */
  total_length: number;
};
export type Location = {
  uic: number;
  secondary_code: string;
};
export type TimingData = {
  arrival_time: string;
  /** Tolerance in ms */
  arrival_time_tolerance_before: number;
  /** Tolerance in ms */
  arrival_time_tolerance_after: number;
};
export type StepType = 'VIA' | 'DRIVER_SWITCH' | 'STOP' | 'BACKTRACK';
export type RequestedStep = {
  /** New consist to use from this step onward. Not included for the first step. */
  consist_change?: ConsistChange;
  /** Duration in ms */
  duration: number;
  location: Location;
  timing_data?: TimingData;
  type?: StepType;
};
export type SimilarTrain = {
  path_date: string;
  /** Train name */
  name: string;
};
export type SubstituteTrain = {
  path_date: string;
  /** Train name */
  name: string;
};
export type CourseType = string;
export type SimulationReport = {
  is_international: boolean;
  rolling_stock: string;
  towed_rolling_stock?: string | null;
  loading_gauge_type: RmiLoadingGaugeType;
  speed_limit_tags: string;
  /** Total mass of the train in kg */
  total_mass: number;
  /** Maximum speed in m/s */
  max_speed: number;
  /** Total length of the train in m */
  total_length: number;
  infra_id: number;
  simulated_steps: SimulatedStep[];
  requested_steps: RequestedStep[];
  departure_time: string;
  user_message?: string | null;
  similar_train?: SimilarTrain | null;
  anterior_train_name?: string | null;
  posterior_train_name?: string | null;
  substitute_train?: SubstituteTrain | null;
  course_type: CourseType;
  statistical_category: string;
  hazardous_materials?: boolean;
  demand_category?: string | null;
  track_section_ranges: {
    /** The beginning of the range in mm. */
    begin: number;
    /** The direction of the range. */
    direction: 'START_TO_STOP' | 'STOP_TO_START';
    /** The end of the range in mm. */
    end: number;
    /** The track section identifier. */
    track_section: string;
  }[];
};
