import { mergeDatasAreaConstant } from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import createSlopeCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createSlopeCurve';
import createCurveCurve from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/createCurveCurve';
import { ElectrificationConditions, SimulationSnapshot } from 'reducers/osrdsimulation/types';
import { SPEED_SPACE_CHART_KEY_VALUES } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';

export interface GevPreparedata {
  speed: Record<string, number>[];
  margins_speed: Record<string, unknown>[];
  eco_speed: Record<string, unknown>[];
  areaBlock: any;
  vmax: Record<string, unknown>[];
  slopesCurve: Record<string, unknown>[];
  slopesHistogram: Record<string, number>[];
  areaSlopesHistogram: Record<string, unknown>[];
  curvesHistogram: Record<string, unknown>[];
  electrificationConditions: ElectrificationConditions[];
}

/// SpeedSpaceChart only
function prepareData(simulation: SimulationSnapshot, selectedTrain: number): GevPreparedata {
  const dataSimulation: GevPreparedata = {
    speed: [],
    margins_speed: [],
    eco_speed: [],
    areaBlock: undefined,
    vmax: [],
    slopesCurve: [],
    slopesHistogram: [],
    areaSlopesHistogram: [],
    curvesHistogram: [],
    electrificationConditions: [],
  };
  dataSimulation.speed = simulation.trains[selectedTrain].base.speeds.map((step) => ({
    ...step,
    speed: step.speed * 3.6,
  }));

  if (simulation.trains[selectedTrain].electrification_conditions) {
    dataSimulation.electrificationConditions = simulation.trains[selectedTrain].electrification_conditions;
  }

  if (simulation.trains[selectedTrain].margins && !simulation.trains[selectedTrain].margins.error) {
    dataSimulation.margins_speed = simulation.trains[selectedTrain].margins.speeds.map((step) => ({
      ...step,
      speed: step.speed * 3.6,
    }));
  }

  if (simulation.trains[selectedTrain].eco && !simulation.trains[selectedTrain].eco.error) {
    dataSimulation.eco_speed = simulation.trains[selectedTrain].eco.speeds.map((step) => ({
      ...step,
      speed: step.speed * 3.6,
    }));
  }

  dataSimulation.areaBlock = mergeDatasAreaConstant(
    dataSimulation.speed,
    [0],
    SPEED_SPACE_CHART_KEY_VALUES
  );
  dataSimulation.vmax = simulation.trains[selectedTrain].vmax.map((step) => ({
    speed: step.speed * 3.6,
    position: step.position,
  }));

  // Slopes
  dataSimulation.slopesCurve = createSlopeCurve(
    simulation.trains[selectedTrain].slopes,
    dataSimulation.speed,
    'speed'
  );
  const zeroLineSlope: number = dataSimulation.slopesCurve[0].height as number; // Start height of histogram
  dataSimulation.slopesHistogram = simulation.trains[selectedTrain].slopes.map((step) => ({
    position: step.position,
    gradient: step.gradient * 4 + zeroLineSlope,
  }));
  dataSimulation.areaSlopesHistogram = mergeDatasAreaConstant(
    dataSimulation.slopesHistogram,
    [zeroLineSlope],
    ['position', 'gradient']
  );

  // Curves
  dataSimulation.curvesHistogram = createCurveCurve(
    simulation.trains[selectedTrain].curves,
    dataSimulation.speed,
    'speed'
  );

  return dataSimulation;
}

export default prepareData;
