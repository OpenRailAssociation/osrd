import type { Comfort } from 'common/api/osrdEditoastApi';
import COLORS from 'modules/rollingStock/components/RollingStockSelector/consts/colors';
import { geti18nKeyForNull } from 'utils/strings';

import type { TransformedCurves, ParsedCurve } from '../types';

const hoveredOpacityCode = 'B3'; // 70% opacity
const lowOpacityCode = '40'; // 25% opacity
const colorsListLength = Object.keys(COLORS).length;

export const getCurveName = (
  name: string,
  comfort: Comfort,
  electricalProfileLevel: string | null,
  powerRestrictionCode: string | null,
  isOnEditionMode?: boolean
) => {
  const electricalProfile = isOnEditionMode ? ` ${geti18nKeyForNull(electricalProfileLevel)}` : '';
  const powerRestriction = powerRestrictionCode
    ? ` ${geti18nKeyForNull(powerRestrictionCode)}`
    : '';
  return `${name} ${comfort}${electricalProfile}${powerRestriction}`;
};

// Format RollingStock Curves to NIVO format
export const parseData = (
  label: string,
  color: string,
  curve: TransformedCurves['index']
): ParsedCurve => {
  // Have to transform data, will change when we'll have multiples curves,
  // so initial transformation is commented :
  // const curveFormatted = curve.map((item)
  // => ({ x: item.speed * 3.6, y: item.max_effort / 1000 }));

  const curveFormatted = curve.speeds.map((speed: number, index: number) => ({
    x: speed * 3.6,
    y: curve.max_efforts[index] / 1000,
  }));

  const curveFormattedSorted = curveFormatted.sort((a, b) => (a.x > b.x ? 1 : -1));

  return {
    id: label,
    color,
    mode: curve.mode,
    comfort: curve.comfort,
    data: curveFormattedSorted,
    electrical_profile_level: geti18nKeyForNull(curve.electricalProfile),
    power_restriction: geti18nKeyForNull(curve.powerRestriction),
  };
};

/** Choose cyclic color for curves depending on curve number */
export function curveColor(
  index: number,
  electricalReferenceForOpacity: string | null,
  hoveredElectricalParam?: string | null,
  selectedElectricalParam?: string | null
) {
  const indexShort = index % colorsListLength;
  if (hoveredElectricalParam) {
    const isHovered = electricalReferenceForOpacity === hoveredElectricalParam;
    const isSelected = electricalReferenceForOpacity === selectedElectricalParam;

    return `${Object.keys(COLORS)[indexShort]}${
      isHovered && !isSelected ? hoveredOpacityCode : ''
    }${!isHovered && !isSelected ? lowOpacityCode : ''}`;
  }
  return Object.keys(COLORS)[indexShort];
}

export function setupCurvesVisibility(
  data: TransformedCurves,
  previousCurvesVisibility: { [key: string]: boolean } = {}
) {
  const nextCurvesVisibility: { [key: string]: boolean } = {};
  Object.keys(data).forEach((id) => {
    nextCurvesVisibility[id] = id in previousCurvesVisibility ? previousCurvesVisibility[id] : true;
  });
  return nextCurvesVisibility;
}

export function initialComfortsState(curvesComfortList: string[]) {
  const comfortsState: { [key: string]: boolean } = {};
  curvesComfortList.forEach((id) => {
    comfortsState[id] = true;
  });
  return comfortsState;
}

export function getCurvesByComfortState(
  transformedData: TransformedCurves,
  comfortsStates: {
    [key: string]: boolean;
  }
) {
  return Object.keys(transformedData).filter(
    (curve) => comfortsStates[transformedData[curve].comfort]
  );
}
