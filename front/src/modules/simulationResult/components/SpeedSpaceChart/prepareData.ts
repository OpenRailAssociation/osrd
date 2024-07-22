import type { PositionData } from 'applications/operationalStudies/types';
import type { GradientPosition, PositionSpeedTime, Train } from 'reducers/osrdsimulation/types';

import type { AreaBlock, GevPreparedData, ReportTrainData } from './types';
import { createCurveCurve, createSlopeCurve } from './utils';

// TODO DROP V1 : remove PositionSpeedTime type
function buildAreaBlocks(speeds: PositionSpeedTime[] | ReportTrainData[]): AreaBlock[] {
  return speeds.map((step) => ({
    position: step.position,
    value0: step.speed,
    value1: 0,
  }));
}

function buildAreaSlopesHistograms(
  slopesHistogram: GradientPosition[] | PositionData<'gradient'>[], // TODO DROP V1 : remove GradientPosition type
  zeroLineSlope: number
): AreaBlock[] {
  return slopesHistogram.map((step) => ({
    position: step.position,
    value0: step.gradient,
    value1: zeroLineSlope,
  }));
}

// TODO DROP V1 : remove this
/**
 * Prepare data for SpeedSpaceChart only
 * - convert all speeds from m/s to km/h
 * - compute areaBlocks, slopesCurve and curvesHistogram
 */
function prepareData(trainSimulation: Train): GevPreparedData {
  const speed = trainSimulation.base.speeds.map((step) => ({
    ...step,
    speed: step.speed * 3.6,
  }));

  const electrificationRanges = trainSimulation.electrification_ranges
    ? trainSimulation.electrification_ranges
    : [];

  const powerRestrictionRanges = trainSimulation.power_restriction_ranges
    ? trainSimulation.power_restriction_ranges
    : [];

  const margins_speed =
    trainSimulation.margins && !trainSimulation.margins.error
      ? trainSimulation.margins.speeds.map((step) => ({
          ...step,
          speed: step.speed * 3.6,
        }))
      : [];

  const eco_speed =
    trainSimulation.eco && !trainSimulation.eco.error
      ? trainSimulation.eco.speeds.map((step) => ({
          ...step,
          speed: step.speed * 3.6,
        }))
      : [];

  const vmax = trainSimulation.vmax.map((step) => ({
    speed: step.speed * 3.6,
    position: step.position,
  }));

  const areaBlock = buildAreaBlocks(speed);

  // Slopes
  const speeds = speed.map((step) => step.speed);

  const gradients = trainSimulation.slopes.map((step) => step.gradient);

  const slopesCurve = createSlopeCurve(trainSimulation.slopes, gradients);

  const zeroLineSlope = slopesCurve[0].height as number; // Start height of histogram

  const slopesHistogram = trainSimulation.slopes.map((step) => ({
    position: step.position,
    gradient: step.gradient * 4 + zeroLineSlope,
  }));

  const areaSlopesHistogram = buildAreaSlopesHistograms(slopesHistogram, zeroLineSlope);

  // Curves
  const curvesHistogram = createCurveCurve(trainSimulation.curves, speeds);

  return {
    areaBlock,
    areaSlopesHistogram,
    curvesHistogram,
    eco_speed,
    electrificationRanges,
    powerRestrictionRanges,
    margins_speed,
    slopesCurve,
    slopesHistogram,
    speed,
    vmax,
  };
}

export default prepareData;
