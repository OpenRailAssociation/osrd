import { TrainScheduleSummary } from 'common/api/osrdEditoastApi';
import { distributedIntervalsFromArrayOfValues } from 'utils/numbers';
import { compact } from 'lodash';

// This helper takes a train list and find & return 3 distributed intervals of schedule duration
const findTrainsDurationsIntervals = (trainsList: TrainScheduleSummary[]) => {
  const durationsList = trainsList.map((train) => ({
    id: train.id,
    duration:
      train.arrival_time > train.departure_time
        ? train.arrival_time - train.departure_time
        : train.arrival_time + 86400 - train.departure_time,
  }));

  return distributedIntervalsFromArrayOfValues(
    compact(durationsList).map((train) => train.duration)
  );
};

export default findTrainsDurationsIntervals;
