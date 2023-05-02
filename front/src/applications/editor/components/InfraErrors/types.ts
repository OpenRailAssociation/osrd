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
  'duplicated_group',
  'empty_object',
  'invalid_group',
  'invalid_reference',
  'invalid_route',
  'invalid_switch_ports',
  'missing_route',
  'missing_buffer_stop',
  'object_out_of_path',
  'odd_buffer_stop_location',
  'out_of_range',
  'overlapping_speed_sections',
  'overlapping_switches',
  'overlapping_track_links',
  'unknown_port_name',
  'unused_port',
];

// Type of an error
// We replace the geographic prop type by geojson
export type InfraError = InfraErrorApiType;
