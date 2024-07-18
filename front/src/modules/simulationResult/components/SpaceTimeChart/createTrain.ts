import {
  formatRouteAspects,
  formatSignalAspects,
  formatStepsWithTime,
  formatStepsWithTimeMulti,
  mergeDatasArea,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import type { ChartAxes } from 'modules/simulationResult/consts';
import type { Train, SimulationTrain } from 'reducers/osrdsimulation/types';

/**
 * Will do some formating & computation to get a trains to be displayed. Stored then with currentSimulation split reducer
 * @param {*} keyValues what do we compare (times vs position vs speed vs slope etc...)
 * @param {*} simulationTrains simulation raw data
 * @returns
 *
 * called with keyValues ['time', 'position']
 */
export default function createTrain(
  keyValues: ChartAxes,
  simulationTrains: Train[]
): SimulationTrain[] {
  // Prepare data
  const dataSimulation = simulationTrains.map((train: Train) => {
    const dataSimulationTrain: SimulationTrain = {
      id: train.id,
      isStdcm: train.isStdcm,
      name: train.name,
      headPosition: formatStepsWithTimeMulti(train.base.head_positions),
      tailPosition: formatStepsWithTimeMulti(train.base.tail_positions),
      routeAspects: formatRouteAspects(train.base.route_aspects),
      signalAspects: formatSignalAspects(train.base.signal_aspects),
      speed: formatStepsWithTime(train.base.speeds),
    };

    /* MARECO */
    if (train.eco && !train.eco.error) {
      return {
        ...dataSimulationTrain,
        eco_headPosition: formatStepsWithTimeMulti(train.eco.head_positions),
        eco_tailPosition: formatStepsWithTimeMulti(train.eco.tail_positions),
        eco_routeAspects: formatRouteAspects(train.eco.route_aspects),
        eco_signalAspects: formatSignalAspects(train.eco.signal_aspects),
        eco_areaBlock: mergeDatasArea<Date | null>(
          dataSimulationTrain.eco_tailPosition,
          dataSimulationTrain.eco_headPosition,
          keyValues
        ),
        eco_speed: formatStepsWithTime(train.eco.speeds),
      };
    }
    return dataSimulationTrain;
  });
  return dataSimulation;
}

// TODO DROP V1: remove this
/**
 * Will do some formating & computation to get trains which will be displayed.
 * @param {*} keyValues what do we compare (times vs position vs speed vs slope etc...)
 * @param {*} train simulation raw data
 * @returns
 */
export function isolatedCreateTrain(keyValues: ChartAxes, train: Train): SimulationTrain {
  const dataSimulationTrain: SimulationTrain = {
    id: train.id,
    isStdcm: train.isStdcm,
    name: train.name,
    headPosition: formatStepsWithTimeMulti(train.base.head_positions),
    tailPosition: formatStepsWithTimeMulti(train.base.tail_positions),
    routeAspects: formatRouteAspects(train.base.route_aspects),
    signalAspects: formatSignalAspects(train.base.signal_aspects),
    speed: formatStepsWithTime(train.base.speeds),
  };

  /* MARECO */
  return train.eco && !train.eco.error
    ? {
        ...dataSimulationTrain,
        eco_headPosition: formatStepsWithTimeMulti(train.eco.head_positions),
        eco_tailPosition: formatStepsWithTimeMulti(train.eco.tail_positions),
        eco_routeAspects: formatRouteAspects(train.eco.route_aspects),
        eco_signalAspects: formatSignalAspects(train.eco.signal_aspects),
        eco_areaBlock: mergeDatasArea<Date | null>(
          dataSimulationTrain.eco_tailPosition,
          dataSimulationTrain.eco_headPosition,
          keyValues
        ),
        eco_speed: formatStepsWithTime(train.eco.speeds),
      }
    : dataSimulationTrain;
}
