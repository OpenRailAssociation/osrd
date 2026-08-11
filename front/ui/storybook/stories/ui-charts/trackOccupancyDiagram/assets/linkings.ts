import { type BrokenLinking, type Linking, type OccupancyZone } from '@osrd-project/ui-charts';

const BLUE = 'rgb(52, 112, 224)';
const PURPLE = 'rgb(169, 56, 181)';
const RED = 'rgb(217, 28, 28)';
const ORANGE = 'rgb(234, 130, 0)';

const time = (hours: number, minutes: number) => {
  const date = new Date(2024, 3, 2);
  date.setHours(hours);
  date.setMinutes(minutes);
  return date.getTime();
};

export const LINKING_OCCUPANCY_ZONES: OccupancyZone[] = [
  {
    pathId: '1',
    trackId: '1',
    trainName: '4655',
    curveStyle: { color: BLUE, opacity: 1 },
    originStation: 'PMP',
    destinationStation: 'BX',
    startTime: time(0, 4),
    endTime: time(0, 10),
  },
  {
    pathId: '2',
    trackId: '1',
    trainName: '8795',
    curveStyle: { color: BLUE, opacity: 1 },
    originStation: 'BX',
    destinationStation: 'TE',
    startTime: time(0, 24),
    endTime: time(0, 30),
  },
  {
    pathId: '3',
    trackId: '1',
    trainName: '4655 3≠',
    curveStyle: { color: BLUE, opacity: 1 },
    originStation: 'PMP',
    destinationStation: 'TE',
    startTime: time(0, 45),
    endTime: time(0, 51),
  },
  {
    pathId: '4',
    trackId: '2',
    trainName: '866862',
    curveStyle: { color: PURPLE, opacity: 1 },
    originStation: 'MMD',
    destinationStation: 'AN',
    startTime: time(0, 2),
    endTime: time(0, 33),
  },
  {
    pathId: '5',
    trackId: '2',
    trainName: '866741',
    curveStyle: { color: ORANGE, opacity: 1 },
    originStation: 'SL',
    destinationStation: 'DRE',
    startTime: time(0, 45),
    endTime: time(0, 55),
  },
  {
    pathId: '6',
    trackId: '3',
    trainName: '865087',
    curveStyle: { color: RED, opacity: 1 },
    originStation: 'MSC',
    destinationStation: 'MSC',
    startTime: time(0, 0),
    endTime: time(0, 23),
  },
  {
    pathId: '7',
    trackId: '3',
    trainName: '865109',
    curveStyle: { color: ORANGE, opacity: 1 },
    originStation: 'SMS',
    destinationStation: 'SMS',
    startTime: time(0, 52),
    endTime: time(1, 10),
  },
  {
    pathId: '8',
    trackId: '4',
    trainName: '4655',
    curveStyle: { color: BLUE, opacity: 1 },
    originStation: 'PMP',
    destinationStation: 'BX',
    startTime: time(0, 5),
    endTime: time(0, 12),
  },
  {
    pathId: '9',
    trackId: '5',
    trainName: '8795',
    curveStyle: { color: BLUE, opacity: 1 },
    originStation: 'BX',
    destinationStation: 'TE',
    startTime: time(0, 26),
    endTime: time(0, 32),
  },
];

export const LINKINGS: Linking[] = [
  {
    id: 'linking-1',
    trackId: '1',
    colors: {
      surface: 'rgb(224, 237, 255)',
      soft: 'rgb(129, 175, 241)',
      base: BLUE,
      strong: 'rgb(36, 76, 145)',
    },
    startTime: time(0, 10),
    endTime: time(0, 24),
    suggested: true,
  },
  {
    id: 'linking-2',
    trackId: '2',
    colors: {
      surface: 'rgb(255, 231, 214)',
      soft: 'rgb(242, 180, 102)',
      base: ORANGE,
      strong: 'rgb(128, 53, 0)',
    },
    startTime: time(0, 33),
    endTime: time(0, 45),
  },
];

export const BROKEN_LINKINGS: BrokenLinking[] = [
  {
    id: 'broken-linking-1',
    trackId: '4',
    direction: 'forward',
    time: time(0, 12),
    name: '8795',
  },
  {
    id: 'broken-linking-1',
    trackId: '5',
    direction: 'backward',
    time: time(0, 26),
    name: '4655',
  },
];
