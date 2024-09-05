/* eslint-disable @typescript-eslint/no-use-before-define */
import * as d3 from 'd3';
import { has, last, memoize } from 'lodash';

import type { PositionData } from 'applications/operationalStudies/types';
import type { ReportTrainData } from 'modules/simulationResult/components/SpeedSpaceChart/types';
import type { ChartAxes, ListValues, XAxis, Y2Axis, YAxis } from 'modules/simulationResult/consts';
import type {
  Position,
  SimulationD3Scale,
  PositionsSpeedTimes,
} from 'reducers/osrdsimulation/types';
import { datetime2time, sec2time } from 'utils/timeManipulation';

export function sec2d3datetime(time: number) {
  return d3.timeParse('%H:%M:%S')(sec2time(time));
}

export function getDirection<T>(data: Position<T>[][]) {
  const lastOfLast = last(last(data));
  return data[0] && lastOfLast && data[0][0].position < lastOfLast.position;
}

export function defineLinear(max: number, pctMarge = 0, origin = 0) {
  return d3.scaleLinear().domain([origin - max * pctMarge, max + max * pctMarge]);
}

// A merged Block is an array of objects, containing a dynamic key and a value associated to it, plus two values; first one is the projection of the value of a second key in another enumeration, and the second one is arbitrary number (often 0). It can help to create areas from values pairs.
export type MergedBlock<Keys extends string> = {
  [K in Keys]: Keys extends K ? number : never;
} & {
  value0: number;
  value1: number;
};

// called with keyValues
// ['position', 'gradient']
// ['position', 'speed']
export const mergeDatasAreaConstant = <Keys extends 'position' | 'gradient'>(
  data1: PositionData<'gradient'>[],
  data2: number,
  keyValues: Keys[]
): MergedBlock<Keys>[] =>
  data1.map((step) => ({
    [keyValues[0]]: step[keyValues[0]],
    value0: step[keyValues[1]],
    value1: data2,
  })) as MergedBlock<Keys>[];

export const gridX = (axisScale: SimulationD3Scale, height: number) =>
  d3
    .axisBottom(axisScale)
    .ticks(10)
    .tickSize(-height)
    .tickFormat(() => '');

export const gridY = (axisScale: SimulationD3Scale, width: number) =>
  d3
    .axisLeft(axisScale)
    .ticks(10)
    .tickSize(-width)
    .tickFormat(() => '');

export const gridY2 = (axisScale: SimulationD3Scale, width: number) =>
  d3
    .axisRight(axisScale)
    .ticks(10)
    .tickSize(-width)
    .tickFormat(() => '');

// Interpolation of cursor based on space position
// ['position', 'speed']
export const interpolateOnPosition = (
  dataSimulation: { speed: ReportTrainData[] },
  positionLocal: number,
  offset: number // in seconds
) => {
  const bisect = d3.bisector<ReportTrainData, number>((d) => d.position).left;
  const index = bisect(dataSimulation.speed, positionLocal, 1);
  const bisection = [dataSimulation.speed[index - 1], dataSimulation.speed[index]];
  if (bisection[1]) {
    const distanceBetweenSteps = bisection[1].position - bisection[0].position;
    const durationBetweenSteps = bisection[1].time - bisection[0].time;
    const distanceFromPrevStep = positionLocal - bisection[0].position;

    const durationFromPrevStep =
      durationBetweenSteps * (distanceFromPrevStep / distanceBetweenSteps);
    return sec2d3datetime(offset + (bisection[0].time + durationFromPrevStep) / 1000);
  }
  return null;
};

// Interpolation of cursor based on time position
// backend is giving only a few number of points. we need to interpolate values between these points.
const interpolateCache = new WeakMap();
export const interpolateOnTime = <
  SimulationData extends Partial<{ [Key in ListValues[number]]: unknown }>,
  Time extends Date | number,
>(
  dataSimulation: SimulationData | undefined,
  keyValues: ChartAxes,
  listValues: ListValues,
  isTrainScheduleV2: boolean = false
) => {
  if (dataSimulation) {
    if (!interpolateCache.has(dataSimulation)) {
      const newInterpolate = memoize(
        specificInterpolateOnTime(dataSimulation, keyValues, listValues, isTrainScheduleV2),
        (timePosition: Date | number) => {
          if (typeof timePosition === 'number') {
            return timePosition;
          }
          return datetime2time(timePosition);
        }
      );
      interpolateCache.set(dataSimulation, newInterpolate);
    }
    return interpolateCache.get(dataSimulation) as (time: Time) => PositionsSpeedTimes<Time>;
  }
  return specificInterpolateOnTime(dataSimulation, keyValues, listValues, isTrainScheduleV2);
};

const specificInterpolateOnTime =
  <
    SimulationData extends Partial<{ [Key in ListValues[number]]: unknown }>,
    Time extends Date | number,
  >(
    dataSimulation: SimulationData | undefined,
    keyValues: ChartAxes,
    listValues: ListValues,
    isTrainScheduleV2: boolean
  ) =>
  (timePositionLocal: Time) => {
    const xAxis = getAxis(keyValues, 'x', false);

    type ObjectWithXAxis = {
      [K in XAxis]?: K extends 'time' ? Time : number;
    } & {
      [K in string]?: K extends XAxis ? never : unknown;
    };
    const bisect = d3.bisector<ObjectWithXAxis, Time>((d) => d[xAxis]! as Time).left;
    const positionInterpolated = {} as PositionsSpeedTimes<Time>;

    listValues.forEach((listValue) => {
      let bisection: [ObjectWithXAxis, ObjectWithXAxis] | undefined;
      if (dataSimulation && has(dataSimulation, listValue)) {
        // not array of array
        // in train schedules v2, all the props are in a array of element
        if (isTrainScheduleV2 || listValue === 'speed' || listValue === 'speeds') {
          const currentData = dataSimulation[listValue] as ObjectWithXAxis[];

          if (currentData.length) {
            const timeBisect = d3.bisector<ObjectWithXAxis, Time>((d) => d.time as Time).left;
            const index = timeBisect(currentData, timePositionLocal, 1);
            bisection = [currentData[index - 1], currentData[index]];
          }
        } else {
          // Array of array
          const currentData = dataSimulation[listValue] as ObjectWithXAxis[][];
          currentData.forEach((section) => {
            const index = bisect(section, timePositionLocal, 1);
            const firstXValue = section[0] ? section[0][xAxis] : undefined;
            if (index !== section.length && firstXValue && timePositionLocal >= firstXValue) {
              bisection = [section[index - 1], section[index]];
            }
          });
        }
        if (bisection && bisection[1] && bisection[1].time) {
          const bisec0 = bisection[0];
          const bisec1 = bisection[1];
          if (bisec0.time && bisec0.position && bisec1.time && bisec1.position) {
            const duration = Number(bisec1.time) - Number(bisec0.time); // en ms
            const timePositionFromTime = Number(timePositionLocal) - Number(bisec0.time);
            const proportion = timePositionFromTime / duration;

            positionInterpolated[listValue] = {
              position: d3.interpolateNumber(bisec0.position, bisec1.position)(proportion),
              speed:
                bisec0.speed && bisec1.speed
                  ? d3.interpolateNumber(
                      bisec0.speed as number,
                      bisec1.speed as number
                    )(proportion) * 3.6
                  : 0,
              time: timePositionLocal,
            };
          }
        }
      }
    });
    return positionInterpolated;
  };

export function getAxis(keyValues: ChartAxes, axis: 'x', rotate: boolean): XAxis;
export function getAxis(keyValues: ChartAxes, axis: 'y', rotate: boolean): YAxis;
export function getAxis(keyValues: ChartAxes, axis: 'y2', rotate: boolean): Y2Axis;
export function getAxis(keyValues: ChartAxes, axis: 'x' | 'y' | 'y2', rotate: boolean) {
  if (axis === 'x') {
    return (!rotate ? keyValues[0] : keyValues[1]) as XAxis;
  }
  return (!rotate ? keyValues[1] : keyValues[0]) as YAxis | Y2Axis;
}
