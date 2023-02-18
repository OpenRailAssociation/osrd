import { formatStepsWithTimeMulti } from 'applications/customget/components/ChartHelpers';

export default function createTrain(dispatch, keyValues, simulationTrains) {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.id = train.id;
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.color = train.color;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTimeMulti(train.base.head_positions);
    dataSimulationTrain.tailPosition = formatStepsWithTimeMulti(train.base.tail_positions);

    return dataSimulationTrain;
  });
  return dataSimulation;
}
