/* eslint-disable import/prefer-default-export */
import { RollingStock } from 'common/api/osrdEditoastApi';

export function isElectric(effortCurves: RollingStock['effort_curves'] | null) {
  if (!effortCurves) {
    return false;
  }
  return Object.values(effortCurves.modes).some((mode) => mode.is_electric);
}
