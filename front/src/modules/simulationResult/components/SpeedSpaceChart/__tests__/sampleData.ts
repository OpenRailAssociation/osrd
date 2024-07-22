import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';

/* eslint-disable import/prefer-default-export */
export const simulation: SimulationResponseSuccess = {
  base: {
    positions: [0, 1000000, 2000000, 3000000],
    speeds: [0, 10, 20],
    energy_consumption: 0,
    scheduled_points_honored: false,
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
    scheduled_points_honored: false,
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
        offset: 0,
        signal: 'signal',
        state: 'state',
        time: 0,
      },
    ],
    spacing_requirements: [{ begin_time: 0, end_time: 0, zone: 'zone' }],
    zone_updates: [
      {
        isEntry: false,
        offset: 0,
        time: 0,
        zone: 'zone',
      },
    ],
  },
  mrsp: {
    positions: [0, 1000000, 2000000, 3000000],
    speeds: [0, 10, 20],
  },
  provisional: {
    positions: [0, 1000000, 2000000, 3000000],
    speeds: [0, 10, 20],
    energy_consumption: 0,
    scheduled_points_honored: true,
    times: [0, 10, 20],
  },
  status: 'success',
};
