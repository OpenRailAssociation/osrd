import * as d3 from 'd3';

import type { PathPropertiesFormatted, PositionData } from 'applications/operationalStudies/types';
import type { SimulationPowerRestrictionRange } from 'common/api/osrdEditoastApi';
import type {
  GradientPosition,
  HeightPosition,
  RadiusPosition,
} from 'reducers/osrdsimulation/types';

import type { PowerRestrictionSegment } from './types';

const calculateReferentialHeight = (data: number[]) => {
  const maxRef = d3.max(data);
  const minRef = d3.min(data);
  let refHeight = 0;
  if (maxRef !== undefined && minRef !== undefined) {
    refHeight = maxRef - minRef;
  }
  return refHeight;
};

export const createCurveCurve = (
  curves: RadiusPosition[] | PositionData<'radius'>[], // TODO DROPV1 : remove RadiusPosition type
  speeds: number[]
): RadiusPosition[] => {
  const referentialHeight = calculateReferentialHeight(speeds);
  const maxRadius = d3.max(curves.map((step) => step.radius));
  const minRadius = d3.min(curves.map((step) => step.radius));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return curves.map((step) => ({
    ...step,
    radius: step.radius > 0 ? (step.radius * referentialHeight) / dataHeight : 0,
  }));
};

/**
 * Create the altitude curve based from the slopes data
 */
export const createSlopeCurve = (
  slopes: GradientPosition[] | PositionData<'gradient'>[],
  gradients: number[]
): HeightPosition[] => {
  const slopesCurve: HeightPosition[] = [];
  slopes.forEach((step, idx) => {
    if (idx % 2 === 0 && slopes[idx + 1]) {
      if (idx === 0) {
        slopesCurve.push({ height: 0, position: step.position });
      } else {
        const distance = step.position - slopesCurve[slopesCurve.length - 1].position;
        const height =
          (distance * slopes[idx - 2].gradient) / 1000 + slopesCurve[slopesCurve.length - 1].height;
        slopesCurve.push({ height, position: step.position });
      }
    }
  });
  const referentialHeight = calculateReferentialHeight(gradients);
  const maxRadius = d3.max(slopesCurve.map((step) => step.height));
  const minRadius = d3.min(slopesCurve.map((step) => step.height));
  let dataHeight = 0;
  if (maxRadius !== undefined && minRadius !== undefined) {
    dataHeight = maxRadius - minRadius;
  }
  return slopesCurve.map((step) => ({
    ...step,
    height: (step.height * referentialHeight) / dataHeight,
  }));
};

export const createPowerRestrictionSegment = (
  fullPowerRestrictionRange: SimulationPowerRestrictionRange[],
  powerRestrictionRange: SimulationPowerRestrictionRange
) => {
  // figure out if the power restriction is incompatible or missing`
  const isRestriction = powerRestrictionRange.handled;
  const isIncompatiblePowerRestriction = !!powerRestrictionRange.code;
  const isStriped = !powerRestrictionRange.code || !powerRestrictionRange.handled;

  const segment: PowerRestrictionSegment = {
    position_start: powerRestrictionRange.start,
    position_end: powerRestrictionRange.stop,
    position_middle: (powerRestrictionRange.start + powerRestrictionRange.stop) / 2,
    lastPosition: fullPowerRestrictionRange.slice(-1)[0].stop,
    height_start: 4,
    height_end: 24,
    height_middle: 14,
    seenRestriction: powerRestrictionRange.code || '',
    usedRestriction: powerRestrictionRange.handled,
    isStriped,
    isRestriction,
    isIncompatiblePowerRestriction,
  };

  return segment;
};

/**
 * Check if the train (in case of bimode rolling stock) runs in thermal mode on the whole path
 * @param electricRanges all of the different path's ranges.
 * If the range is electrified and the train us the eletrical mode, mode_handled is true
 */
export const runsOnlyThermal = (electricRanges: PathPropertiesFormatted['electrifications']) =>
  // TODO TS2 : what to do with handled ?
  !electricRanges.some(
    (range) => range.electrificationUsage.type === 'electrification'
    //    &&
    //     range.electrificationUsage.mode_handled
  );
