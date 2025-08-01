import {
  type DataPoint,
  type OccupancyZone,
  type OperationalPoint,
  type PathData,
  type PathLevel,
  positionKmToMm,
} from '@osrd-project/ui-charts';
import { cloneDeep, inRange, keyBy } from 'lodash';

const MIN = 60 * 1000;

export function getPaths<T extends object>(
  prefix: string,
  points: OperationalPoint[],
  pauseTime: number,
  offset: number,
  speed: number,
  count: number,
  t0: number,
  additionalAttributes: T
): (PathData & T)[] {
  speed = Math.abs(speed);
  const res: (PathData & T)[] = [];

  for (let i = 0; i < count; i++) {
    let t = t0 + i * offset;
    let p = points[0].position;
    const path: PathData & T = {
      id: `${prefix}-${i + 1}`,
      label: `Train ${prefix} ${i + 1}`,
      points: [
        {
          position: p,
          time: t,
        },
      ],
      ...additionalAttributes,
    };

    points.forEach((point, index) => {
      if (index) {
        const previousPoint = points[index - 1];
        // Travel:
        const travelDistance = point.position - previousPoint.position;
        const travelTime = Math.abs(travelDistance) / speed;
        p += travelDistance;
        t += travelTime;
        path.points.push({
          position: p,
          time: t,
        });
      }

      // Stop:
      t += pauseTime;
      path.points.push({
        position: p,
        time: t,
      });
    });

    res.push(path);
  }

  return res;
}

export const OPERATIONAL_POINTS: OperationalPoint[] = [
  {
    id: 'city-a',
    label: 'Point A',
    position: positionKmToMm(0),
    importanceLevel: 1,
  },
  {
    id: 'city-b',
    label: 'Point B',
    position: positionKmToMm(10),
    importanceLevel: 2,
  },
  {
    id: 'city-c',
    label: 'Point C',
    position: positionKmToMm(60),
    importanceLevel: 1,
  },
  {
    id: 'city-d',
    label: 'Point D',
    position: positionKmToMm(70),
    importanceLevel: 2,
  },
  {
    id: 'city-e',
    label: 'Point E',
    position: positionKmToMm(90),
    importanceLevel: 2,
  },
  {
    id: 'city-f',
    label: 'Point F',
    position: positionKmToMm(140),
    importanceLevel: 1,
  },
];
export const OPERATIONAL_POINTS_DICT = keyBy(OPERATIONAL_POINTS, 'id');

const REVERSED_POINTS = OPERATIONAL_POINTS.slice(0).reverse();
const EXTREME_POINTS = [OPERATIONAL_POINTS[0], OPERATIONAL_POINTS[2], OPERATIONAL_POINTS[5]];
const REVERSED_EXTREME_POINTS = EXTREME_POINTS.slice(0).reverse();
const BACK_AND_FORTH_POINTS = [
  OPERATIONAL_POINTS_DICT['city-b'],
  OPERATIONAL_POINTS_DICT['city-d'],
  OPERATIONAL_POINTS_DICT['city-e'],
  OPERATIONAL_POINTS_DICT['city-d'],
  OPERATIONAL_POINTS_DICT['city-b'],
];
const REVERSED_BACK_AND_FORTH_POINTS = [
  OPERATIONAL_POINTS_DICT['city-e'],
  OPERATIONAL_POINTS_DICT['city-d'],
  OPERATIONAL_POINTS_DICT['city-b'],
  OPERATIONAL_POINTS_DICT['city-d'],
  OPERATIONAL_POINTS_DICT['city-e'],
];

export const START_DATE = new Date('2024/04/02');

// TODO:
// Store and share the hardcoded colors with other stories that use the GET as well
export type PathDisplay = PathData & {
  color: string;
  border?: {
    offset: number;
    level: PathLevel;
    color: string;
    backgroundColor?: string;
  };
  level?: PathLevel;
};
export const PATHS: PathDisplay[] = [
  // Inter OP
  {
    id: 'single-point',
    label: 'Single Point',
    points: [
      {
        position: positionKmToMm(50),
        time: +START_DATE + 10 * MIN,
      },
    ],
    color: '#C75300',
  },
  // Paced Train
  ...getPaths(
    'Paced',
    OPERATIONAL_POINTS,
    3 * MIN,
    60 * MIN,
    positionKmToMm(80) / (60 * MIN),
    2,
    +START_DATE + 10 * MIN,
    {
      color: '#B2539E',
      border: {
        offset: 3.5,
        color: '#B2539E',
        backgroundColor: '#FAE6F6',
      },
    }
  ),
  ...getPaths(
    'Selected Paced',
    OPERATIONAL_POINTS,
    3 * MIN,
    60 * MIN,
    positionKmToMm(80) / (60 * MIN),
    1,
    +START_DATE + 40 * MIN,
    {
      color: '#B2539E',
      level: 1,
      border: {
        offset: 4,
        color: 'transparent',
        backgroundColor: '#FAE6F6',
      },
    }
  ),
  // Omnibuses:
  ...getPaths(
    'omnibus',
    OPERATIONAL_POINTS,
    3 * MIN,
    30 * MIN,
    positionKmToMm(80) / (60 * MIN),
    5,
    +START_DATE,
    { color: '#FF362E' }
  ),
  ...getPaths(
    'omnibus-reversed',
    REVERSED_POINTS,
    3 * MIN,
    35 * MIN,
    positionKmToMm(80) / (60 * MIN),
    4,
    +START_DATE,
    { color: '#FF8E3D' }
  ),

  // Fast trains:
  ...getPaths(
    'fast',
    EXTREME_POINTS,
    5 * MIN,
    50 * MIN,
    positionKmToMm(140) / (60 * MIN),
    3,
    +START_DATE,
    {
      color: '#526CE8',
      fromEnd: 'out',
      toEnd: 'out',
    }
  ),
  ...getPaths(
    'fast-reversed',
    REVERSED_EXTREME_POINTS,
    5 * MIN,
    45 * MIN,
    positionKmToMm(140) / (60 * MIN),
    3,
    +START_DATE,
    { color: '#66C0F1', fromEnd: 'out', toEnd: 'out' }
  ),

  // Back and forth trains:
  ...getPaths(
    'back-and-forth',
    BACK_AND_FORTH_POINTS,
    10 * MIN,
    30 * MIN,
    positionKmToMm(80) / (60 * MIN),
    2,
    +START_DATE + 15 * MIN,
    { color: '#286109', toEnd: 'out' }
  ),
  ...getPaths(
    'back-and-forth-reversed',
    REVERSED_BACK_AND_FORTH_POINTS,
    12 * MIN,
    30 * MIN,
    positionKmToMm(80) / (60 * MIN),
    2,
    +START_DATE + 3 * MIN,
    { color: '#64cc2b', toEnd: 'out' }
  ),
];

export function getOccupancyZonesFromPathAtGivenWaypoint<T extends object>(
  points: DataPoint[],
  waypointPosition: number,
  additionalAttributes: T
) {
  const res: (Pick<OccupancyZone, 'startDirection' | 'endDirection' | 'startTime' | 'endTime'> &
    T)[] = [];

  points.forEach(({ position, time }, i, a) => {
    if (!i) return;
    const { position: prevPosition, time: prevTime } = a[i - 1];
    const next = a[i + 1];
    const beforePrev = a[i - 2];

    // First case: Segment on waypoint
    if (position === waypointPosition && prevPosition === waypointPosition) {
      res.push({
        startDirection: !beforePrev
          ? undefined
          : beforePrev.position < prevPosition
            ? 'up'
            : 'down',
        startTime: prevTime,
        endDirection: !next ? undefined : next.position < position ? 'up' : 'down',
        endTime: time,
        ...cloneDeep(additionalAttributes),
      });
    }

    // Second case: Single point exactly on waypoint
    else if (position === waypointPosition && (!next || next.position !== waypointPosition)) {
      res.push({
        startDirection: prevPosition < waypointPosition ? 'up' : 'down',
        startTime: time,
        endDirection: !next ? undefined : next.position < position ? 'up' : 'down',
        endTime: time,
        ...cloneDeep(additionalAttributes),
      });
    }

    // Third case: Segment crossing waypoint
    else if (
      position !== waypointPosition &&
      prevPosition !== waypointPosition &&
      inRange(waypointPosition, prevPosition, position)
    ) {
      const crossTime =
        prevTime +
        ((waypointPosition - prevPosition) / (position - prevPosition)) * (time - prevTime);
      res.push({
        startDirection: prevPosition < waypointPosition ? 'up' : 'down',
        startTime: crossTime,
        endDirection: position < waypointPosition ? 'up' : 'down',
        endTime: crossTime,
        ...cloneDeep(additionalAttributes),
      });
    }
  });

  return res;
}
