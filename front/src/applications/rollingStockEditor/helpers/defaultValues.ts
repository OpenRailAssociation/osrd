import type { Comfort, RollingStock } from 'common/api/osrdEditoastApi';
import { THERMAL_TRACTION_IDENTIFIER } from 'modules/rollingStock/consts';
import type { MultiUnitsParameter } from 'modules/rollingStock/types';
import { msToKmh } from 'utils/physics';
import type { ValueOf } from 'utils/types';

import { RS_SCHEMA_PROPERTIES, newRollingStockValues } from '../consts';
import type { EffortCurveForms, RollingStockParametersValues } from '../types';

export function makeEffortCurve(selectedMode: string): ValueOf<EffortCurveForms> {
  return {
    curves: [
      {
        cond: {
          comfort: 'STANDARD',
          electrical_profile_level: null,
          power_restriction_code: null,
        },
        curve: {
          max_efforts: [0],
          speeds: [0],
        },
      },
    ],
    default_curve: {
      max_efforts: [],
      speeds: [],
    },
    is_electric: !(selectedMode === THERMAL_TRACTION_IDENTIFIER),
  };
}

export const getDefaultRollingStockMode = (selectedMode: string | null): EffortCurveForms | null =>
  selectedMode
    ? {
        [`${selectedMode}`]: makeEffortCurve(selectedMode),
      }
    : null;

const getDefaultMultiUnitsParameter = (parameter: string): MultiUnitsParameter => {
  const { min, max, units } = RS_SCHEMA_PROPERTIES.find((rsParam) => rsParam.title === parameter)!;
  return {
    min: min!,
    max: max!,
    unit: units![0],
    value: 0,
  };
};

export const getRollingStockEditorDefaultValues = (
  rollingStockData?: RollingStock
): RollingStockParametersValues =>
  rollingStockData
    ? {
        railjsonVersion: rollingStockData.railjson_version,
        name: rollingStockData.name,
        detail: rollingStockData.metadata?.detail || '',
        family: rollingStockData.metadata?.family || '',
        grouping: rollingStockData.metadata?.grouping || '',
        number: rollingStockData.metadata?.number || '',
        reference: rollingStockData.metadata?.reference || '',
        series: rollingStockData.metadata?.series || '',
        subseries: rollingStockData.metadata?.subseries || '',
        type: rollingStockData.metadata?.type || '',
        unit: rollingStockData.metadata?.unit || '',
        length: rollingStockData.length,
        mass: {
          ...getDefaultMultiUnitsParameter('mass'),
          value: rollingStockData.mass / 1000, // The mass received is in kg and should appear in tons.
        },
        maxSpeed: {
          ...getDefaultMultiUnitsParameter('maxSpeed'),
          value: msToKmh(rollingStockData.max_speed), // The speed received is in m/s and should appear in km/h.
        },
        startupTime: rollingStockData.startup_time,
        startupAcceleration: rollingStockData.startup_acceleration,
        comfortAcceleration: rollingStockData.comfort_acceleration,
        constGamma: rollingStockData.const_gamma,
        inertiaCoefficient: rollingStockData.inertia_coefficient,
        loadingGauge: rollingStockData.loading_gauge,
        rollingResistanceA: {
          ...getDefaultMultiUnitsParameter('rollingResistanceA'),
          value: rollingStockData.rolling_resistance.A / 1000, // The b resistance received is in N and should appear in kN.
        },
        rollingResistanceB: {
          ...getDefaultMultiUnitsParameter('rollingResistanceB'),
          value: rollingStockData.rolling_resistance.B / (1000 * 3.6), // The b resistance received is in N/(m/s) and should appear in kN/(km/h).
        },
        rollingResistanceC: {
          ...getDefaultMultiUnitsParameter('rollingResistanceC'),
          value: rollingStockData.rolling_resistance.C / (1000 * 3.6 ** 2), // The c resistance received is in N/(m/s)² and should appear in kN/(km/h)².
        },
        electricalPowerStartupTime: rollingStockData.electrical_power_startup_time || null,
        raisePantographTime: rollingStockData.raise_pantograph_time || null,
        basePowerClass: rollingStockData.base_power_class || null,
        powerRestrictions: rollingStockData.power_restrictions,
        supportedSignalingSystems: rollingStockData.supported_signaling_systems,
        etcsBrakeParams: rollingStockData.etcs_brake_params || undefined,
        primaryCategory: rollingStockData.primary_category,
        categories: new Set([
          ...rollingStockData.other_categories,
          rollingStockData.primary_category,
        ]),
      }
    : {
        ...newRollingStockValues,
        categories: new Set(),
      };

export const createEmptyCurve = (
  comfort: Comfort,
  electricalProfile: string | null = null,
  powerRestriction: string | null = null
) => ({
  cond: {
    comfort,
    electrical_profile_level: electricalProfile,
    power_restriction_code: powerRestriction,
  },
  curve: { speeds: [0], max_efforts: [0] },
});

/** Given a tractionMode and a list of comfort, return empty EffortCurves */
export const createEmptyCurves = (tractionMode: string, comforts: Comfort[]) => ({
  curves: comforts.map((comfort) => createEmptyCurve(comfort)),
  default_curve: { speeds: [0], max_efforts: [0] },
  is_electric: tractionMode !== THERMAL_TRACTION_IDENTIFIER,
});
