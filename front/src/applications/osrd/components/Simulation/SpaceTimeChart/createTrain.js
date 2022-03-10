import {
  formatStepsWithTime,
  formatStepsWithTimeMulti,
  makeStairCase,
  mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';

import { setFailure } from 'reducers/main.ts';

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
      train.base.route_end_occupancy,
    );
    dataSimulationTrain.routeBeginOccupancy = formatStepsWithTimeMulti(
      train.base.route_begin_occupancy,
    );
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.routeEndOccupancy,
      dataSimulationTrain.routeBeginOccupancy,
      keyValues,
    );
    dataSimulationTrain.speed = formatStepsWithTime(train.base.speeds);

    /* MARECO */
    if (train.eco && !train.eco.error) {
      dataSimulationTrain.eco_headPosition = formatStepsWithTimeMulti(
        train.eco.head_positions,
      );
      dataSimulationTrain.eco_tailPosition = formatStepsWithTimeMulti(
        train.eco.tail_positions,
      );
      dataSimulationTrain.eco_routeEndOccupancy = formatStepsWithTimeMulti(
        train.eco.route_end_occupancy,
      );
      dataSimulationTrain.eco_routeBeginOccupancy = formatStepsWithTimeMulti(
        train.eco.route_begin_occupancy,
      );
      dataSimulationTrain.eco_areaBlock = mergeDatasArea(
        dataSimulationTrain.eco_routeEndOccupancy,
        dataSimulationTrain.eco_routeBeginOccupancy,
        keyValues,
      );
      dataSimulationTrain.eco_speed = formatStepsWithTime(train.eco.speeds);
    } else if (train.eco && train.eco.error) { // Tbe removed, useless
      dispatch(setFailure({
        name: t('errors.eco'),
        message: train.eco.error,
      }));
    }
    return dataSimulationTrain;
  });
  return dataSimulation;
}
