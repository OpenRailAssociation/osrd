import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';

/* eslint-disable import/prefer-default-export */
export const simulation: SimulationResponseSuccess = {
  base: {
    positions: [0, 1000000, 2000000, 3000000],
    speeds: [0, 10, 20],
    energy_consumption: 0,
    path_item_times: [],
    times: [0, 10, 20],
  },
  electrical_profiles: {
    boundaries: [1000000, 2000000, 3000000],
    values: [
      { electrical_profile_type: 'profile', handled: true, profile: 'O' },
      { electrical_profile_type: 'profile', handled: true, profile: 'A1' },
      { electrical_profile_type: 'profile', handled: true, profile: 'B' },
    ],
  },
  final_output: {
    energy_consumption: 0,
    positions: [0, 1000000, 2000000, 3000000],
    path_item_times: [],
    speeds: [0, 10, 20],
    times: [0, 10, 20],
    routing_requirements: [
      {
        begin_time: 0,
        route: 'route',
        zones: [
          {
            end_time: 0,
            entry_detector: 'entry_detector',
            exit_detector: 'exit_detector',
            switches: {},
            zone: 'zone',
          },
        ],
      },
    ],
    signal_sightings: [
      {
        signal: 'signal',
        state: 'state',
        position: 0,
        time: 0,
      },
    ],
    spacing_requirements: [{ begin_time: 0, end_time: 0, zone: 'zone' }],
    zone_updates: [
      {
        is_entry: false,
        position: 0,
        time: 0,
        zone: 'zone',
      },
    ],
  },
  mrsp: {
    boundaries: [1000000, 2000000, 2500000],
    values: [
      {
        speed: 0,
        source: { speed_limit_source_type: 'given_train_tag', tag: 'MA90' },
      },
      {
        speed: 10,
        source: { speed_limit_source_type: 'fallback_tag', tag: 'MA80' },
      },
      {
        speed: 10,
        source: null,
      },
      {
        speed: 20,
        source: { speed_limit_source_type: 'unknown_tag' },
      },
    ],
  },
  provisional: {
    positions: [0, 1000000, 2000000, 3000000],
    speeds: [0, 10, 20],
    energy_consumption: 0,
    path_item_times: [],
    times: [0, 10, 20],
  },
  status: 'success',
};
