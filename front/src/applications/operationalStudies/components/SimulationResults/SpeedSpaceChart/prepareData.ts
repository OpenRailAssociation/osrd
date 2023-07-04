import createSlopeCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createSlopeCurve';
import createCurveCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createCurveCurve';
import {
  GradientPosition,
  HeightPosition,
  PositionSpeedTime,
  RadiusPosition,
  SpeedPosition,
  Train,
} from 'reducers/osrdsimulation/types';
import { ElectrificationRange, PowerRestrictionRangeItem } from 'common/api/osrdEditoastApi';

interface IAreaBlock {
  position: number;
  value0: number;
  value1: number[];
}

export interface GevPreparedata {
  areaBlock: IAreaBlock[];
  areaSlopesHistogram: IAreaBlock[];
  curvesHistogram: RadiusPosition[];
  eco_speed: PositionSpeedTime[];
  electrificationRanges: ElectrificationRange[];
  powerRestrictionRanges: PowerRestrictionRangeItem[];
  margins_speed: PositionSpeedTime[];
  slopesCurve: HeightPosition[];
  slopesHistogram: GradientPosition[];
  speed: PositionSpeedTime[];
  vmax: SpeedPosition[];
}

function buildAreaBlocks(speeds: PositionSpeedTime[]): IAreaBlock[] {
  return speeds.map((step) => ({
    position: step.position,
    value0: step.speed,
    value1: [0],
  }));
}

function buildAreaSlopesHistograms(
  slopesHistogram: GradientPosition[],
  zeroLineSlope: number
): IAreaBlock[] {
  return slopesHistogram.map((step) => ({
    position: step.position,
    value0: step.gradient,
    value1: [zeroLineSlope],
  }));
}

/**
 * Prepare data for SpeedSpaceChart only
 * - convert all speeds from m/s to km/h
 * - compute areaBlocks, slopesCurve and curvesHistogram
 */
function prepareData(trainSimulation: Train): GevPreparedata {
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
  const slopesCurve = createSlopeCurve(trainSimulation.slopes, speed, 'speed');

  const zeroLineSlope = slopesCurve[0].height as number; // Start height of histogram

  const slopesHistogram = trainSimulation.slopes.map((step) => ({
    position: step.position,
    gradient: step.gradient * 4 + zeroLineSlope,
  }));

  const areaSlopesHistogram = buildAreaSlopesHistograms(slopesHistogram, zeroLineSlope);

  // Curves
  const curvesHistogram: RadiusPosition[] = createCurveCurve(
    trainSimulation.curves,
    speed,
    'speed'
  );

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
