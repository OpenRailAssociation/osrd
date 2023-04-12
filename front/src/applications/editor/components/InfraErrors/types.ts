import {
  GetInfraByIdErrorsApiArg,
  InfraError as InfraErrorApiType,
} from '../../../../common/api/osrdEditoastApi';

// Error level
export type InfraErrorLevel = GetInfraByIdErrorsApiArg['level'];
export const InfraErrorLevelList: Array<InfraErrorLevel> = ['all', 'errors', 'warnings'];

// Error type
export type InfraErrorType = GetInfraByIdErrorsApiArg['errorType'];
export const InfraErrorTypeList: Array<InfraErrorType> = [
  'invalid_reference',
  'out_of_range',
  'empty_path',
  'path_does_not_match_endpoints',
  'unknown_port_name',
  'invalid_switch_ports',
  'empty_object',
  'object_out_of_path',
  'odd_buffer_stop_location',
  'missing_route',
  'unused_port',
  'duplicated_group',
  'missing_buffer_stop',
  'path_is_not_continuous',
  'overlapping_speed_sections',
  'overlapping_switches',
  'overlapping_track_links',
];

// Type of an error
// We replace the geographic prop type by geojson
export type InfraError = InfraErrorApiType;
