export type PowerRestriction = {
  code: string;
  handled: boolean;
  start: number;
  stop: number;
};

export const powerRestrictionsPmpLm: PowerRestriction[] = [
  {
    code: 'FFFF',
    handled: true,
    start: 0,
    stop: 6503965,
  },
  {
    code: 'FFFF',
    handled: false,
    start: 6503965,
    stop: 7106965,
  },
  {
    code: 'FFFF',
    handled: true,
    start: 7106965,
    stop: 53305965,
  },
  {
    code: 'FFFF',
    handled: false,
    start: 63305965,
    stop: 63996965,
  },
  {
    code: 'AAAA',
    handled: false,
    start: 63996965,
    stop: 93473965,
  },
  {
    code: 'AAAA',
    handled: false,
    start: 93473965,
    stop: 94165965,
  },
  {
    code: 'FFFF',
    handled: true,
    start: 94165965,
    stop: 131273965,
  },
  {
    code: 'FFFF',
    handled: false,
    start: 131273965,
    stop: 131965965,
  },
  {
    code: 'GGGG',
    handled: true,
    start: 131965965,
    stop: 179005965,
  },
  {
    code: 'GGGG',
    handled: false,
    start: 179005965,
    stop: 179011965,
  },
  {
    code: 'GGGG',
    handled: true,
    start: 179011965,
    stop: 179841965,
  },
  {
    code: 'BBBB',
    handled: false,
    start: 179841965,
    stop: 180550965,
  },
  {
    code: 'BBBB',
    handled: true,
    start: 180550965,
    stop: 201649000,
  },
];
