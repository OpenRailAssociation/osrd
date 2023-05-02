import { ScheduledTrain } from 'reducers/osrdsimulation/types';
import { distributedIntervalsFromArrayOfValues } from 'utils/numbers';

// This helper takes a train list and find & return 3 distributed intervals of schedule duration
const findTrainsDurationsIntervals = (trainsList: ScheduledTrain[]) => {
  const durationsList = trainsList.map((train) => ({
    id: train.id,
    duration:
      train.arrival > train.departure
        ? train.arrival - train.departure
        : train.arrival + 86400 - train.departure,
  }));

  return distributedIntervalsFromArrayOfValues(durationsList.map((train) => train.duration));
};

export default findTrainsDurationsIntervals;
