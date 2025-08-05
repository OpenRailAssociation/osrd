import type { EffortCurveForms } from 'applications/rollingStockEditor/types';
import type { RollingStock } from 'common/api/osrdEditoastApi';

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
