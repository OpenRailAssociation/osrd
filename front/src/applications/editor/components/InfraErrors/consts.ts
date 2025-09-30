import type { InfraErrorTypeLabel } from './types';

export const INFRA_ERRORS_BY_LEVEL: Record<'errors' | 'warnings', Set<InfraErrorTypeLabel>> = {
  errors: new Set([
    'invalid_group',
    'invalid_reference',
    'invalid_route',
    'invalid_switch_ports',
    'object_out_of_path',
    'out_of_range',
    'unknown_port_name',
    'node_endpoints_not_unique',
  ]),
  warnings: new Set([
    'duplicated_group',
    'empty_object',
    'missing_route',
    'missing_buffer_stop',
    'odd_buffer_stop_location',
    'overlapping_speed_sections',
    'overlapping_switches',
    'overlapping_electrifications',
    'unused_port',
  ]),
};

export const INFRA_ERRORS = [...INFRA_ERRORS_BY_LEVEL.warnings, ...INFRA_ERRORS_BY_LEVEL.errors];
