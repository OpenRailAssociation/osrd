import { Geometry } from '@turf/helpers';
import { EditoastType } from '../../tools/types';

export const InfraErrorLevelList = ['all', 'errors', 'warnings'];
export type InfraErrorLevel = typeof InfraErrorLevelList[number];

export const InfraErrorTypeList = [
  'invalid_reference',
  'out_of_range',
  'empty_path',
  'path_does_not_match_endpoints',
  'unknown_port_name',
  'invalid_switch_ports',
  'empty_object',
  'object_out_of_path',
  'missing_route',
  'unused_port',
  'duplicated_group',
  'no_buffer_stop',
  'path_is_not_continuous',
  'overlapping_switches',
  'overlapping_track_links',
];
export type InfraErrorType = typeof InfraErrorTypeList[number];

export interface InfraError {
  information: {
    error_type: InfraErrorType;
    field: string;
    is_warning: boolean;
    obj_id: string;
    obj_type: EditoastType;
  };
  geographic?: Geometry;
}
