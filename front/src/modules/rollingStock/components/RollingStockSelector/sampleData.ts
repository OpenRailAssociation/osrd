import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

const ROLLING_STOCK_SAMPLE_DATA: RollingStockWithLiveries = {
  id: 9,
  version: 1,
  name: 'TC64700',
  effort_curves: {
    modes: {
      thermal: {
        curves: [
          {
            cond: {
              comfort: 'STANDARD',
              electrical_profile_level: null,
              power_restriction_code: null,
            },
            curve: {
              speeds: [
                0, 1.3194444444444444, 1.5277777777777777, 2.7777777777777777, 4.166666666666667,
                5.555555555555555, 6.944444444444445, 8.333333333333334, 11.11111111111111,
                13.88888888888889, 16.666666666666668, 19.444444444444443, 22.22222222222222,
              ],
              max_efforts: [
                305000, 305000, 275000, 170000, 101500, 69250, 50000, 39000, 24000, 15000, 7500,
                3000, 100,
              ],
            },
          },
        ],
        default_curve: {
          speeds: [
            0, 1.3194444444444444, 1.5277777777777777, 2.7777777777777777, 4.166666666666667,
            5.555555555555555, 6.944444444444445, 8.333333333333334, 11.11111111111111,
            13.88888888888889, 16.666666666666668, 19.444444444444443, 22.22222222222222,
          ],
          max_efforts: [
            305000, 305000, 275000, 170000, 101500, 69250, 50000, 39000, 24000, 15000, 7500, 3000,
            100,
          ],
        },
        is_electric: false,
      },
    },
    default_mode: 'thermal',
  },
  base_power_class: '9',
  length: 26.07,
  max_speed: 22.22222222222222,
  startup_time: 25,
  startup_acceleration: 0.03,
  comfort_acceleration: 0.08,
  gamma: {
    type: 'CONST',
    value: 0.5,
  },
  inertia_coefficient: 1.2,
  mass: 132000,
  rolling_resistance: {
    type: 'davis',
    A: 1344,
    B: 47.52,
    C: 3.888,
  },
  loading_gauge: 'G1',
  power_restrictions: {},
  energy_sources: [],
  electrical_power_startup_time: null,
  raise_pantograph_time: null,
  railjson_version: '3.2',
  locked: true,
  metadata: {
    detail: 'BB 64700',
    family: 'LOCOMOTIVES',
    type: 'Locomotives thermiques',
    grouping: 'Locomotives diesel',
    series: 'BB 64700',
    subseries: '',
    unit: 'US',
    number: '1',
    reference: '',
  },
  liveries: [
    {
      id: 312,
      name: 'default',
      rolling_stock_id: 9,
      compound_image_id: 1908,
    },
  ],
  supported_signaling_systems: ['BAL', 'BAPR'],
};

export default ROLLING_STOCK_SAMPLE_DATA;
