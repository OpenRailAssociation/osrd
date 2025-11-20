import { baseRailwayManagerApi as api } from './baseGeneratedApis';
export const addTagTypes = ['timetable'] as const;
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
export type Interval = string;
export type Items = {
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
    use_electrical_profiles?: boolean;
    use_speed_limits_for_simulation?: boolean;
  };
  path: {
    /** The unique identifier of the path item.
        This is used to reference path items in the train schedule. */
    id: string;
    /** The location of a path waypoint */
    location:
      | {
          /** Offset in mm */
          offset: number;
          /** Track section identifier */
          track: string;
        }
      | {
          operational_point:
            | {
                /** The object id of an operational point */
                operational_point: string;
              }
            | {
                /** An optional secondary code to identify a more specific location */
                secondary_code?: string | null;
                /** The operational point trigram */
                trigram: string;
              }
            | {
                /** An optional secondary code to identify a more specific location */
                secondary_code?: string | null;
                /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
                uic: number;
              };
          track_reference?:
            | null
            | (
                | {
                    track_id: string;
                  }
                | {
                    track_name: string;
                  }
              );
        };
  }[];
  power_restrictions?: {
    from: string;
    to: string;
    value: string;
  }[];
  rolling_stock_name: string;
  schedule?: {
    arrival?: null | Interval;
    /** Position on the path of the schedule item. */
    at: string;
    /** State of the signal where the train is received for its stop.
        For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>. */
    reception_signal?: 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
    stop_for?: null | Interval;
  }[];
  speed_limit_tag?: null | string;
  start_time: string;
  train_name: string;
};
export type ConstraintDistribution = 'STANDARD' | 'MARECO';
export type Options = {
  use_electrical_profiles?: boolean;
  use_speed_limits_for_simulation?: boolean;
};
export type Margins = {
  boundaries: string[];
  /** The values of the margins. Must contains one more element than the boundaries
    Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km` */
  values: string[];
};
export type Items2 = {
  /** The unique identifier of the path item.
    This is used to reference path items in the train schedule. */
  id: string;
  /** The location of a path waypoint */
  location:
    | {
        /** Offset in mm */
        offset: number;
        /** Track section identifier */
        track: string;
      }
    | {
        operational_point:
          | {
              /** The object id of an operational point */
              operational_point: string;
            }
          | {
              /** An optional secondary code to identify a more specific location */
              secondary_code?: string | null;
              /** The operational point trigram */
              trigram: string;
            }
          | {
              /** An optional secondary code to identify a more specific location */
              secondary_code?: string | null;
              /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
              uic: number;
            };
        track_reference?:
          | null
          | (
              | {
                  track_id: string;
                }
              | {
                  track_name: string;
                }
            );
      };
};
export type Items3 = {
  arrival?: null | Interval;
  /** Position on the path of the schedule item. */
  at: string;
  /** State of the signal where the train is received for its stop.
    For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>. */
  reception_signal?: 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
  stop_for?: null | Interval;
};
export type Comfort = 'STANDARD' | 'AIR_CONDITIONING' | 'HEATING';
export type ComponentsSchemasTransformTimetableResponsePropertiesTrainSchedulesItemsPropertiesCategoryOneOf1 =

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
  /** List of train schedules */
  train_schedules: {
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
      use_electrical_profiles?: boolean;
      use_speed_limits_for_simulation?: boolean;
    };
    path: {
      /** The unique identifier of the path item.
            This is used to reference path items in the train schedule. */
      id: string;
      /** The location of a path waypoint */
      location:
        | {
            /** Offset in mm */
            offset: number;
            /** Track section identifier */
            track: string;
          }
        | {
            operational_point:
              | {
                  /** The object id of an operational point */
                  operational_point: string;
                }
              | {
                  /** An optional secondary code to identify a more specific location */
                  secondary_code?: string | null;
                  /** The operational point trigram */
                  trigram: string;
                }
              | {
                  /** An optional secondary code to identify a more specific location */
                  secondary_code?: string | null;
                  /** The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point */
                  uic: number;
                };
            track_reference?:
              | null
              | (
                  | {
                      track_id: string;
                    }
                  | {
                      track_name: string;
                    }
                );
          };
    }[];
    power_restrictions?: {
      from: string;
      to: string;
      value: string;
    }[];
    rolling_stock_name: string;
    schedule?: {
      arrival?: null | Interval;
      /** Position on the path of the schedule item. */
      at: string;
      /** State of the signal where the train is received for its stop.
            For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>. */
      reception_signal?: 'OPEN' | 'STOP' | 'SHORT_SLIP_STOP';
      stop_for?: null | Interval;
    }[];
    speed_limit_tag?: null | string;
    start_time: string;
    train_name: string;
  }[];
  /** List of paced trains */
  paced_trains: (Items & {
    exceptions: ({
      occurrence_index?: number;
    } & {
      constraint_distribution?: {
        value: ConstraintDistribution;
      };
      disabled?: boolean;
      initial_speed?: {
        value: number;
      };
      /** Unique key for the exception within the paced train, required and generated by the frontend. */
      key: string;
      labels?: {
        value: string[];
      };
      options?: {
        value: Options;
      };
      path_and_schedule?: {
        margins: Margins;
        path: Items2[];
        power_restrictions: {
          from: string;
          to: string;
          value: string;
        }[];
        schedule: Items3[];
      };
      rolling_stock?: {
        comfort: Comfort;
        rolling_stock_name: string;
      };
      rolling_stock_category?: {
        value?: null | ComponentsSchemasTransformTimetableResponsePropertiesTrainSchedulesItemsPropertiesCategoryOneOf1;
      };
      speed_limit_tag?: {
        value?: null | string;
      };
      start_time?: {
        value: string;
      };
      train_name?: {
        value: string;
      };
    })[];
    paced: {
      /** Time between two occurrences, an ISO 8601 format is expected */
      interval: string;
      /** Duration of the paced train, an ISO 8601 format is expected */
      time_window: Interval;
    };
  })[];
};
export type ErrorResponse = {
  /** Error message describing what went wrong */
  detail: string;
};
