import type { PathPropertiesFormatted, PositionData } from 'applications/operationalStudies/types';
import type {
  SimulationPowerRestrictionRange,
  SimulationResponse,
} from 'common/api/osrdEditoastApi';
import type { GradientPosition, PositionSpeedTime, Train } from 'reducers/osrdsimulation/types';

import type { AreaBlock, GevPreparedData, GevPreparedDataV2, ReportTrainData } from './types';
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

/**
 * Prepare data for SpeedSpaceChart only
 * - convert all speeds from m/s to km/h
 * - convert all positions from mm to m
 * - compute areaBlocks, slopesCurve and curvesHistogram
 */
export const prepareSpeedSpaceDataV2 = (
  trainSimulation: SimulationResponse,
  selectedTrainPowerRestrictions: SimulationPowerRestrictionRange[],
  pathProperties: PathPropertiesFormatted
): GevPreparedDataV2 | null => {
  if (trainSimulation.status !== 'success') return null;

  const { electrifications, curves, slopes } = pathProperties;
  const { base, final_output, provisional, mrsp } = trainSimulation;

  const baseSpeedData: ReportTrainData[] = base.speeds.map((speed, i) => ({
    speed: speed * 3.6,
    position: base.positions[i] / 1000,
    time: base.times[i],
  }));

  // provisional takes count of margins
  const standardMarginSpeedData: ReportTrainData[] = provisional.speeds.map((speed, i) => ({
    speed: speed * 3.6,
    position: provisional.positions[i] / 1000,
    time: provisional.times[i],
  }));

  // final_output takes count of schedule points
  const schedulePointsMarginSpeedData: ReportTrainData[] = final_output.speeds.map((speed, i) => ({
    speed: speed * 3.6,
    position: final_output.positions[i] / 1000,
    time: final_output.times[i],
  }));

  const mrspData = mrsp.speeds.map((speed, i) => ({
    speed: speed * 3.6,
    position: mrsp.positions[i] / 1000,
  }));

  const areaBlock = buildAreaBlocks(baseSpeedData);

  // Slopes
  const gradients = slopes.map((step) => step.gradient);

  const slopesCurve = createSlopeCurve(slopes, gradients);

  const zeroLineSlope = slopesCurve[0].height as number; // Start height of histogram

  const slopesHistogram = slopes.map((step) => ({
    position: step.position,
    gradient: step.gradient * 4 + zeroLineSlope,
  }));

  const areaSlopesHistogram = buildAreaSlopesHistograms(slopesHistogram, zeroLineSlope);

  // Curves
  const baseSpeeds = baseSpeedData.map((step) => step.speed);

  const curvesHistogram = createCurveCurve(curves, baseSpeeds);

  return {
    areaBlock,
    areaSlopesHistogram,
    electrificationRanges: electrifications,
    powerRestrictionRanges: selectedTrainPowerRestrictions,
    speed: baseSpeedData,
    standardMarginSpeedData,
    schedulePointsMarginSpeedData,
    mrspData,
    slopesCurve,
    slopesHistogram,
    curvesHistogram,
  };
};

export default prepareData;
