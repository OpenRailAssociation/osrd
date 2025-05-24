import type { TimeLockDto, TrainrunSectionDto } from '../components/NGE/types';

const sourceDeparture30min: TimeLockDto = {
  time: 6 * 60 + 30, // 06:30
  consecutiveTime: 0,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const sourceDeparture0min: TimeLockDto = {
  time: 7 * 60, // 07:00
  consecutiveTime: 0,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const sourceDeparture60min: TimeLockDto = {
  time: 8 * 60, // 08:00
  consecutiveTime: 0,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const sourceDeparture5min: TimeLockDto = {
  time: 9 * 60 + 5, // 09:05
  consecutiveTime: 0,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const mockTrainrunSections: TrainrunSectionDto[] = [
  {
    id: 1,
    sourceNodeId: 101,
    sourcePortId: 1,
    targetNodeId: 201,
    targetPortId: 2,
    sourceDeparture: sourceDeparture30min,
    sourceArrival: {
      time: 6 * 60 + 35, // 06:35
      consecutiveTime: 5,
      lock: false,
      warning: null,
      timeFormatter: null,
    },
    targetDeparture: {
      time: 6 * 60 + 36, // 06:36
      consecutiveTime: 6,
      lock: true,
      warning: null,
      timeFormatter: null,
    },
    targetArrival: {
      time: 7 * 60 + 10, // 07:10
      consecutiveTime: 40,
      lock: false,
      warning: null,
      timeFormatter: null,
    },
    travelTime: {
      time: 35, // minutes
      consecutiveTime: 35,
      lock: false,
      warning: null,
      timeFormatter: null,
    },
    numberOfStops: 0,
    trainrunId: 1001,
    resourceId: 501,
    specificTrainrunSectionFrequencyId: 2001,
    path: {
      path: [],
      textPositions: [],
    },
    warnings: [],
  },
  // {
  //   id: 2,
  //   sourceNodeId: 201,
  //   sourcePortId: 2,
  //   targetNodeId: 301,
  //   targetPortId: 3,
  //   sourceDeparture: {
  //     time: 7 * 60 + 15, // 07:15
  //     consecutiveTime: 45,
  //     lock: true,
  //     warning: null,
  //     timeFormatter: null,
  //   },
  //   sourceArrival: {
  //     time: 7 * 60 + 40, // 07:40
  //     consecutiveTime: 70,
  //     lock: false,
  //     warning: null,
  //     timeFormatter: null,
  //   },
  //   targetDeparture: {
  //     time: 7 * 60 + 42, // 07:42
  //     consecutiveTime: 72,
  //     lock: true,
  //     warning: null,
  //     timeFormatter: null,
  //   },
  //   targetArrival: {
  //     time: 8 * 60 + 30, // 08:30
  //     consecutiveTime: 120,
  //     lock: false,
  //     warning: null,
  //     timeFormatter: null,
  //   },
  //   travelTime: {
  //     time: 48, // minutes
  //     consecutiveTime: 48,
  //     lock: false,
  //     warning: null,
  //     timeFormatter: null,
  //   },
  //   numberOfStops: 1,
  //   trainrunId: 1001,
  //   resourceId: 502,
  //   specificTrainrunSectionFrequencyId: 2002,
  //   path: {
  //     path: [],
  //     textPositions: [],
  //   },
  //   warnings: [],
  // },
];

export const mockTimeLock: TimeLockDto = {
  time: 8 * 60 + 45, // 08:45
  consecutiveTime: 135,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const mockStartTimeLock: TimeLockDto = {
  time: 6 * 60 + 30, // 06:30
  consecutiveTime: 0,
  lock: true,
  warning: null,
  timeFormatter: null,
};

export const mockStartDate: Date = new Date('2025-05-24T06:00:00.000Z');

export const timeLockWithNullTime: TimeLockDto = {
  time: null,
  consecutiveTime: null,
  lock: false,
  warning: null,
  timeFormatter: null,
};

export const mockStartTimeLock1: TimeLockDto = {
  time: 600,
  consecutiveTime: 0,
  lock: false,
  warning: null,
  timeFormatter: null,
};

export const mockArrivalTimeLock: TimeLockDto = {
  ...mockStartTimeLock1,
  time: 600,
  consecutiveTime: 600,
};
export const startTimeLock2: TimeLockDto = {
  ...mockStartTimeLock1,
  time: 600,
  consecutiveTime: 700,
};
