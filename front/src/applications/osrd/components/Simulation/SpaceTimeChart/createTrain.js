import {
  formatRouteAspects,
  formatSignalAspects,
  formatStepsWithTime,
  formatStepsWithTimeMulti,
  makeStairCase,
  mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';

import { setFailure } from 'reducers/main.ts';

/**
 * Will do some formating & computation to get a trains to be displayed. Stored then with currentSimulation splitted reducer
 * @param {*} dispatch react action dispatcher
 * @param {*} keyValues what do we compare (times vs position vs speed vs slope etc...)
 * @param {*} simulationTrains simulation raw data
 * @param {*} t translation middle
 * @returns
 */
export default function createTrain(dispatch, keyValues, simulationTrains, t) {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.id = train.id;
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTimeMulti(train.base.head_positions);
    dataSimulationTrain.tailPosition = formatStepsWithTimeMulti(train.base.tail_positions);
    dataSimulationTrain.routeEndOccupancy = formatStepsWithTimeMulti(
      train.base.route_end_occupancy
    );
    dataSimulationTrain.routeBeginOccupancy = formatStepsWithTimeMulti(
      train.base.route_begin_occupancy
    );

    dataSimulationTrain.routeAspects = formatRouteAspects(train.base.route_aspects);
    dataSimulationTrain.signalAspects = formatSignalAspects(train.base.signal_aspects);

    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.routeEndOccupancy,
      dataSimulationTrain.routeBeginOccupancy,
      keyValues
    );
    dataSimulationTrain.speed = formatStepsWithTime(train.base.speeds);

    /* MARECO */
    if (train.eco && !train.eco.error) {
      dataSimulationTrain.eco_headPosition = formatStepsWithTimeMulti(train.eco.head_positions);
      dataSimulationTrain.eco_tailPosition = formatStepsWithTimeMulti(train.eco.tail_positions);
      dataSimulationTrain.eco_routeEndOccupancy = formatStepsWithTimeMulti(
        train.eco.route_end_occupancy
      );
      dataSimulationTrain.eco_routeBeginOccupancy = formatStepsWithTimeMulti(
        train.eco.route_begin_occupancy
      );
      dataSimulationTrain.eco_routeAspects = formatRouteAspects(train.eco.route_aspects);
      dataSimulationTrain.eco_signalAspects = formatSignalAspects(train.eco.signal_aspects);
      dataSimulationTrain.eco_areaBlock = mergeDatasArea(
        dataSimulationTrain.eco_routeEndOccupancy,
        dataSimulationTrain.eco_routeBeginOccupancy,
        keyValues
      );
      dataSimulationTrain.eco_speed = formatStepsWithTime(train.eco.speeds);
    } else if (train.eco && train.eco.error) {
      // Tbe removed, useless
      dispatch(
        setFailure({
          name: t('errors.eco'),
          message: train.eco.error,
        })
      );
    }
    return dataSimulationTrain;
  });
  return dataSimulation;
}
