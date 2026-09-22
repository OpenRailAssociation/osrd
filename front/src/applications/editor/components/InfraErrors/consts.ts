import type { InfraErrorTypeLabel } from './types';

// Unlike other structures Record ensures exhaustiveness (all keys in InfraErrorTypeLabel are present (and only them)) when type checking
const INFRA_ERRORS_LEVELS: Record<InfraErrorTypeLabel, 'errors' | 'warnings'> = {
  invalid_group: 'errors',
  invalid_reference: 'errors',
  invalid_route: 'errors',
  invalid_switch_ports: 'errors',
  object_out_of_path: 'errors',
  out_of_range: 'errors',
  overlapping_switches: 'errors',
  unknown_port_name: 'errors',
  node_endpoints_not_unique: 'errors',

  duplicated_group: 'warnings',
  empty_object: 'warnings',
  missing_route: 'warnings',
  missing_buffer_stop: 'warnings',
  odd_buffer_stop_location: 'warnings',
  overlapping_speed_sections: 'warnings',
  overlapping_electrifications: 'warnings',
  unused_port: 'warnings',
};

export const INFRA_ERRORS = Object.keys(INFRA_ERRORS_LEVELS) as InfraErrorTypeLabel[];

export const INFRA_ERRORS_BY_LEVEL: Record<'errors' | 'warnings', Set<InfraErrorTypeLabel>> = {
  errors: new Set(INFRA_ERRORS.filter((k) => INFRA_ERRORS_LEVELS[k] === 'errors')),
  warnings: new Set(INFRA_ERRORS.filter((k) => INFRA_ERRORS_LEVELS[k] === 'warnings')),
};
