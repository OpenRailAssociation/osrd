import { formatStepsWithTimeMulti } from 'applications/customget/components/ChartHelpers';

export default function createTrain(dispatch, keyValues, simulationTrains, t) {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.id = train.id;
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTimeMulti(train.base.head_positions);

    return dataSimulationTrain;
  });
  return dataSimulation;
}
