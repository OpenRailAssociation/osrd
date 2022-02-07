import {
  formatStepsWithTime, formatStepsWithTimeMulti,
  makeStairCase, mergeDatasArea,
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

    /* MARGINS */
    if (train.margins && !train.margins.error) {
      dataSimulationTrain.margins_headPosition = formatStepsWithTimeMulti(
        train.margins.head_positions,
      );
      dataSimulationTrain.margins_tailPosition = formatStepsWithTimeMulti(
        train.margins.tail_positions,
      );
      dataSimulationTrain.margins_routeEndOccupancy = formatStepsWithTimeMulti(
        train.margins.route_end_occupancy,
      );
      dataSimulationTrain.margins_routeBeginOccupancy = formatStepsWithTimeMulti(
        train.margins.route_begin_occupancy,
      );
      dataSimulationTrain.margins_areaBlock = mergeDatasArea(
        dataSimulationTrain.margins_routeEndOccupancy,
        dataSimulationTrain.margins_routeBeginOccupancy,
        keyValues,
      );
      dataSimulationTrain.margins_speed = formatStepsWithTime(train.margins.speeds);
    } else if (train.margins && train.margins.error) {
      dispatch(setFailure({
        name: t('errors.margins'),
        message: train.margins.error,
      }));
    }
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
    } else if (train.eco && train.eco.error) {
      dispatch(setFailure({
        name: t('errors.eco'),
        message: train.eco.error,
      }));
    }
    return dataSimulationTrain;
  });
  return dataSimulation;
}
