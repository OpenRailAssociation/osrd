import { isElectric } from 'modules/rollingStock/helpers/electric';

import { EP_BY_MODE } from '../consts';
import type { RollingStockParametersValues, EffortCurveForms } from '../types';

export function modifyRollingStockElectricalValues(
  currentRollingStockValues: RollingStockParametersValues,
  effortCurves: EffortCurveForms | null
) {
  const isCurrentElectric = isElectric(effortCurves);
  if (!isCurrentElectric) {
    return {
      ...currentRollingStockValues,
      electricalPowerStartupTime: null,
      raisePantographTime: null,
    };
  }
  return currentRollingStockValues;
}

export const orderElectricalProfils = (
  electricalProfilesList: (string | null)[],
  selectedTractionMode: string | null
) => {
  const isSelectedModeWithProfiles =
    selectedTractionMode === '1500V' || selectedTractionMode === '25000V';
  if (isSelectedModeWithProfiles) {
    const refArray = EP_BY_MODE[selectedTractionMode];
    return electricalProfilesList.sort((a, b) => refArray.indexOf(a) - refArray.indexOf(b));
  }
  return electricalProfilesList;
};
