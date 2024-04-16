/* eslint-disable import/prefer-default-export */
import type { RollingStock } from 'common/api/osrdEditoastApi';
import type { EffortCurveForms } from 'modules/rollingStock/types';

export function isElectric(effortCurves: EffortCurveForms | null) {
  if (!effortCurves) {
    return false;
  }
  return Object.values(effortCurves).some((mode) => mode.is_electric);
}

export function isThermal(effortCurves: RollingStock['effort_curves']['modes']) {
  return Object.values(effortCurves).some((mode) => !mode.is_electric);
}

export function getSupportedElectrification(effortCurves: RollingStock['effort_curves']['modes']) {
  const tractionModes = Object.keys(effortCurves);
  return tractionModes.filter((mode) => mode !== 'thermal');
}
