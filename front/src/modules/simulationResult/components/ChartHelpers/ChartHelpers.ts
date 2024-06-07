/* eslint-disable @typescript-eslint/no-use-before-define */
import * as d3 from 'd3';
import type { BaseType } from 'd3';
import { has, last, memoize } from 'lodash';

import type { PositionData } from 'applications/operationalStudies/types';
import type { ReportTrainData } from 'modules/simulationResult/components/SpeedSpaceChart/types';
import type { ChartAxes, ListValues, XAxis, Y2Axis, YAxis } from 'modules/simulationResult/consts';
import type {
  Position,
  PositionSpeedTime,
  RouteAspect,
  ConsolidatedRouteAspect,
  SignalAspect,
  MergedDataPoint,
  Train,
  Stop,
  SimulationD3Scale,
  PositionsSpeedTimes,
} from 'reducers/osrdsimulation/types';
import { datetime2time, durationInSeconds, sec2time } from 'utils/timeManipulation';

export function sec2d3datetime(time: number) {
  return d3.timeParse('%H:%M:%S')(sec2time(time));
}

/* eslint-disable no-bitwise */
export function colorModelToHex(color: number) {
  return `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${
    (color >> 24) & 0xff
  })`;
}
/* eslint-enable no-bitwise */

/**
 * returns Contextualized offset not depending on days ahead
 */
export function offsetSeconds(seconds: number) {
  if (seconds > 85399) {
    return seconds - 86400;
  }
  if (seconds < 0) {
    return seconds + 86400;
  }
  return seconds;
}

export function getDirection<T>(data: Position<T>[][]) {
  const lastOfLast = last(last(data));
  return data[0] && lastOfLast && data[0][0].position < lastOfLast.position;
}

export function defineTime<T extends number | Date>(extent: [T, T]) {
  return d3.scaleTime().domain(extent);
}

export function defineLinear(max: number, pctMarge = 0, origin = 0) {
  return d3.scaleLinear().domain([origin - max * pctMarge, max + max * pctMarge]);
}

export function formatStepsWithTime<T extends { time: number }>(data: Array<T> = []) {
  return data.map((step) => ({ ...step, time: sec2d3datetime(step.time) }));
}

export const formatStepsWithTimeMulti = (data: Position[][]): Position<Date | null>[][] =>
  data.map((section) =>
    section.map((step) => ({ time: sec2d3datetime(step.time), position: step.position }))
  );

export const formatRouteAspects = (data: RouteAspect[] = []): ConsolidatedRouteAspect[] =>
  data.map((step) => ({
    ...step,
    time_start: sec2d3datetime(step.time_start),
    time_end: sec2d3datetime(step.time_end),
    color: colorModelToHex(step.color),
  }));

/**
 * Signal Aspects (state of signals in the simulation depending on time)
 * need some formatting before inclusion in consolidatedSimulation
 * @param {Array} data
 * @returns
 */
export const formatSignalAspects = (
  data: SignalAspect[] = []
): SignalAspect<Date | null, string>[] =>
  data.map((step) => ({
    ...step,
    time_start: sec2d3datetime(step.time_start),
    time_end: sec2d3datetime(step.time_end),
    color: colorModelToHex(step.color),
  }));

export function makeStairCase(data: Array<{ time: number; position: number }>) {
  const newData: Array<{ time: number; position: number }> = [];
  const { length } = data;
  data.forEach((step, idx) => {
    newData.push(step);
    if (idx < length - 1) {
      newData.push({
        time: data[idx + 1].time,
        position: step.position,
      });
    }
  });
  return newData;
}

// TODO DROP V1 : remove this
export const timeShiftTrain = (train: Train, offset: number): Train => ({
  ...train,
  base: {
    mechanical_energy_consumed: train.base.mechanical_energy_consumed,
    head_positions: train.base.head_positions.map((section) =>
      section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
    ),
    tail_positions: train.base.tail_positions.map((section) =>
      section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
    ),
    route_aspects: train.base.route_aspects.map((square) => ({
      ...square,
      time_start: offsetSeconds(square.time_start + offset),
      time_end: offsetSeconds(square.time_end + offset),
    })),
    speeds: train.base.speeds.map((step) => ({
      ...step,
      time: offsetSeconds(step.time + offset),
    })),
    stops: train.base.stops.map((stop) => ({
      ...stop,
      time: offsetSeconds(stop.time + offset),
    })),
  },
  margins: train.margins
    ? {
        ...train.margins,
        head_positions: train.margins.head_positions.map((section) =>
          section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
        ),
        tail_positions: train.margins.tail_positions.map((section) =>
          section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
        ),
        speeds: train.margins.speeds.map((step) => ({
          ...step,
          time: offsetSeconds(step.time + offset),
        })),
        stops: train.margins.stops.map((stop) => ({
          ...stop,
          time: offsetSeconds(stop.time + offset),
        })),
      }
    : undefined,
  eco: train.eco
    ? {
        ...train.eco,
        head_positions: train.eco.head_positions.map((section) =>
          section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
        ),
        tail_positions: train.eco.tail_positions.map((section) =>
          section.map((step) => ({ ...step, time: offsetSeconds(step.time + offset) }))
        ),
        route_aspects: train.eco.route_aspects.map((square) => ({
          ...square,
          time_start: offsetSeconds(square.time_start + offset),
          time_end: offsetSeconds(square.time_end + offset),
        })),
        speeds: train.eco.speeds.map((step) => ({
          ...step,
          time: offsetSeconds(step.time + offset),
        })),
        stops: train.eco.stops.map((stop) => ({
          ...stop,
          time: offsetSeconds(stop.time + offset),
        })),
      }
    : undefined,
});

// Merge two curves for creating area between
export const mergeDatasArea = <T>(
  data1?: Position<T>[][],
  data2?: Position<T>[][],
  keyValues?: ChartAxes
) => {
  if (data1 && data2 && keyValues) {
    const areas = data1.map((data1Section, sectionIdx) => {
      type KeyOfPosition = keyof Position;
      const points: MergedDataPoint<T>[] = [];
      for (let i = 0; i <= data1Section.length; i += 2) {
        points.push({
          [keyValues[0]]: data1Section[i][keyValues[0] as KeyOfPosition],
          value0: data1Section[i][keyValues[1] as KeyOfPosition],
          value1: data2[sectionIdx][i][keyValues[1] as KeyOfPosition],
        });
        if (data1Section[i + 1] && data2[sectionIdx][i + 1]) {
          points.push({
            [keyValues[0]]: data2[sectionIdx][i + 1][keyValues[0] as KeyOfPosition],
            value0: data1Section[i + 1][keyValues[1] as KeyOfPosition],
            value1: data2[sectionIdx][i + 1][keyValues[1] as KeyOfPosition],
          });
        }
        if (data1Section[i + 2] && data2[sectionIdx][i + 2]) {
          points.push({
            [keyValues[0]]: data2[sectionIdx][i + 1][keyValues[0] as KeyOfPosition],
            value0: data1Section[i + 1][keyValues[1] as KeyOfPosition],
            value1: data2[sectionIdx][i + 2][keyValues[1] as KeyOfPosition],
          });
          points.push({
            [keyValues[0]]: data1Section[i + 1][keyValues[0] as KeyOfPosition],
            value0: data1Section[i + 1][keyValues[1] as KeyOfPosition],
            value1: data2[sectionIdx][i + 2][keyValues[1] as KeyOfPosition],
          });
        }
      }
      return points;
    });
    return areas;
  }
  return [];
};

// A merged Block is an array of objects, containing a dynamic key and a value associated to it, plus two values; first one is the projection of the value of a second key in another enumeration, and the second one is arbitrary number (often 0). It can help to create areas from values pairs.
export type MergedBlock<Keys extends string> = {
  [K in Keys]: Keys extends K ? number : never;
} & {
  value0: number;
  value1: number;
};

// TODO DROP V1 : remove this
// called with keyValues
// ['position', 'gradient']
// ['position', 'speed']
export const mergeDatasAreaConstant = <Keys extends string>(
  data1: Record<Keys, number>[],
  data2: number,
  keyValues: Keys[]
): MergedBlock<Keys>[] =>
  data1.map((step) => ({
    [keyValues[0]]: step[keyValues[0]],
    value0: step[keyValues[1]],
    value1: data2,
  })) as MergedBlock<Keys>[];

// called with keyValues
// ['position', 'gradient']
// ['position', 'speed']
export const mergeDatasAreaConstantV2 = <Keys extends 'position' | 'gradient'>(
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
  dataSimulation: { speed: PositionSpeedTime[] | ReportTrainData[] }, // TODO DROP V1 : remove PositionSpeedTime type
  positionLocal: number
) => {
  const bisect = d3.bisector<PositionSpeedTime, number>((d) => d.position).left;
  const index = bisect(dataSimulation.speed, positionLocal, 1);
  const bisection = [dataSimulation.speed[index - 1], dataSimulation.speed[index]];
  if (bisection[1]) {
    const distance = bisection[1].position - bisection[0].position;
    const distanceFromPosition = positionLocal - bisection[0].position;
    const proportion = distanceFromPosition / distance;
    return sec2d3datetime(d3.interpolateNumber(bisection[0].time, bisection[1].time)(proportion));
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

export const isSpaceTimeChart = (keyValues: ChartAxes) => keyValues[0] === 'time';

export const isSpaceSlopesCurves = (keyValues: ChartAxes) => keyValues[1] === 'gradient';

export function trainWithDepartureAndArrivalTimes(train: Train, dragOffset = 0) {
  const firstStop = train.base.stops[0];
  const lastStop = last(train.base.stops) as Stop;
  const departure = offsetSeconds(firstStop.time + dragOffset);
  const arrival = offsetSeconds(lastStop.time + dragOffset);
  const mechanicalEnergyConsumed = {
    base: train.base?.mechanical_energy_consumed,
    eco: train.eco?.mechanical_energy_consumed,
  };

  return {
    id: train.id,
    labels: train.labels,
    train_name: train.name,
    path_id: train.path,
    path_length: last(train.base.stops)?.position,
    mechanical_energy_consumed: mechanicalEnergyConsumed,
    departure_time: departure,
    arrival_time: arrival,
    stops_count: train.base.stops.filter((stop) => stop.duration > 0).length - 1,
    duration: durationInSeconds(departure, arrival),
    speed_limit_tags: train.speed_limit_tags,
  };
}

/**
 * Get the width of an element based on its text content
 * @param text the text content of the element
 * @param fontSize the font size of the element (pixel)
 * @param selector the name of the DOM selector (id, class...)
 * @returns the width of the element
 */
export function getElementWidth(text: string, fontSize: number, selector: string) {
  const element = d3.select(selector).insert('text').text(text).attr('font-size', fontSize);
  const node = element.node();
  if (!node) {
    throw new Error();
  }
  const result = node.getBBox().width;
  return result;
}

export function getAxis(keyValues: ChartAxes, axis: 'x', rotate: boolean): XAxis;
export function getAxis(keyValues: ChartAxes, axis: 'y', rotate: boolean): YAxis;
export function getAxis(keyValues: ChartAxes, axis: 'y2', rotate: boolean): Y2Axis;
export function getAxis(keyValues: ChartAxes, axis: 'x' | 'y' | 'y2', rotate: boolean) {
  if (axis === 'x') {
    return (!rotate ? keyValues[0] : keyValues[1]) as XAxis;
  }
  return (!rotate ? keyValues[1] : keyValues[0]) as YAxis | Y2Axis;
}

export function buildStripe(
  stripSelection: d3.Selection<BaseType, unknown, null, undefined>,
  {
    id,
    color,
    width = 8,
    height = 8,
    strokeWidth = 2.5,
  }: { id: string; color: string; width?: number; height?: number; strokeWidth?: number }
) {
  stripSelection
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', width)
    .attr('height', height)
    .append('path')
    .attr('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth);
}
