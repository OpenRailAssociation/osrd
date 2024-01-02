/* eslint-disable import/prefer-default-export */
import type { EffortCurveForms } from 'modules/rollingStock/types';

export function isElectric(effortCurves: EffortCurveForms | null) {
  if (!effortCurves) {
    return false;
  }
  return Object.values(effortCurves).some((mode) => mode.is_electric);
}
