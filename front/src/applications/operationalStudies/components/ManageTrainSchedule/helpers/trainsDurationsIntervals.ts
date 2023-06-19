import { TrainScheduleWithDetails } from 'common/api/osrdEditoastApi';
import { ScheduledTrain } from 'reducers/osrdsimulation/types';
import { distributedIntervalsFromArrayOfValues } from 'utils/numbers';
import { compact } from 'lodash';

// This helper takes a train list and find & return 3 distributed intervals of schedule duration
// const findTrainsDurationsIntervals = (trainsList: ScheduledTrain[]) => {
//   const durationsList = trainsList.map((train) => ({
//     id: train.id,
//     duration:
//       train.arrival > train.departure
//         ? train.arrival - train.departure
//         : train.arrival + 86400 - train.departure,
//   }));

//   return distributedIntervalsFromArrayOfValues(durationsList.map((train) => train.duration));
// };

const findTrainsDurationsIntervals = (trainsList: TrainScheduleWithDetails[]) => {
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
