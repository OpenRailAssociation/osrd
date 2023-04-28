import { ScheduledTrain } from 'reducers/osrdsimulation/types';

export type IntervalPositionType = {
  duration: number;
  interval: number;
};
export type TrainsWithIntervalPositionType =
  | object
  | {
      [key: number]: IntervalPositionType;
    };

// This function takes a train duration & the distributed intervals, and return the position of train inside intervals
const durationSort = (duration: number, intervals: number[]) => {
  if (duration < intervals[1]) return 0;
  if (duration < intervals[2]) return 1;
  return 2;
};

// This helper takes a train list and find & return 3 distributed intervals of schedule duration
const trainsDurationsIntervals = (trainsList: ScheduledTrain[]) => {
  const durationsList = trainsList.map((train) => ({
    id: train.id,
    duration:
      train.arrival > train.departure
        ? train.arrival - train.departure
        : train.arrival + 86400 - train.departure,
  }));

  durationsList.sort((a, b) => a.duration - b.duration);
  const trainsCount = durationsList.length;
  const indices = [Math.floor(trainsCount / 3), Math.floor((2 * trainsCount) / 3)];
  const intervals = [
    durationsList[0].duration,
    ...indices.map((i) =>
      trainsCount % 2 === 0
        ? (durationsList[i].duration + durationsList[i - 1].duration) / 2
        : durationsList[i].duration
    ),
    durationsList[trainsCount - 1].duration,
  ];

  const trainsWithIntervalPosition: TrainsWithIntervalPositionType = {};
  durationsList.forEach((train) => {
    trainsWithIntervalPosition[train.id] = {
      duration: train.duration,
      interval: durationSort(train.duration, intervals),
    };
  });
  return trainsWithIntervalPosition;
};

export default trainsDurationsIntervals;
