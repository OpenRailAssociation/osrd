import * as d3 from 'd3';
import { last } from 'lodash';

import { durationInSeconds, sec2time } from 'utils/timeManipulation';
// import/no-cycle is disabled because this func call will be removed by refacto
// eslint-disable-next-line
import {
  Position,
  PositionSpeedTime,
  RouteAspect,
  ConsolidatedRouteAspect,
  SignalAspect,
  MergedDataPoint,
  Train,
  Stop,
  SimulationD3Scale,
} from 'reducers/osrdsimulation/types';
import { TIME } from '../simulationResultsConsts';

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

// Time shift a train
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
  keyValues?: string[]
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

// Interpolation of cursor based on space position
// ['position', 'speed']
export const interpolateOnPosition = <
  Keys extends string,
  SpeedObject extends Record<Keys, number> & { position: number; time: number }
>(
  dataSimulation: { speed: SpeedObject[] },
  keyValues: readonly Keys[],
  positionLocal: number
) => {
  const bisect = d3.bisector<SpeedObject, number>((d) => d[keyValues[0]]).left;
  const index = bisect(dataSimulation.speed, positionLocal, 1);
  const bisection = [dataSimulation.speed[index - 1], dataSimulation.speed[index]];
  if (bisection[1]) {
    const distance = bisection[1].position - bisection[0].position;
    const distanceFromPosition = positionLocal - bisection[0].position;
    const proportion = distanceFromPosition / distance;
    return sec2d3datetime(d3.interpolateNumber(bisection[0].time, bisection[1].time)(proportion));
  }
  return false;
};

// Interpolation of cursor based on time position
// backend is giving only a few number of points. we need to interpolate values between these points.
export const interpolateOnTime = <ListValues extends string, Time = number>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSimulation: Partial<Record<ListValues, any>> | undefined,
  keyValues: readonly string[],
  listValues: readonly ListValues[],
  timePositionLocal: Time
) => {
  type Key = (typeof keyValues)[0];
  type ObjectWithGivenKey = { [key: Key]: Time } & {
    [key: string]: unknown;
  };
  const bisect = d3.bisector<ObjectWithGivenKey, Time>((d) => d[keyValues[0]]).left;
  const positionInterpolated = {} as Record<ListValues, PositionSpeedTime<Time>>;
  listValues.forEach((listValue) => {
    let bisection;
    if (dataSimulation?.[listValue]) {
      // If not array of array
      if (listValue === 'speed' || listValue === 'speeds') {
        const comparator = dataSimulation[listValue] || dataSimulation[listValue][0];
        if (comparator) {
          const timeBisect = d3.bisector<ObjectWithGivenKey, Time>((d) => d.time).left;
          const index = timeBisect(dataSimulation[listValue], timePositionLocal, 1);
          bisection = [dataSimulation[listValue][index - 1], dataSimulation[listValue][index]];
        }
      } else {
        // Array of array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataSimulation[listValue].forEach((section: any[]) => {
          const index = bisect(section, timePositionLocal, 1);
          if (
            index !== section.length &&
            section[0] &&
            timePositionLocal >= section[0][keyValues[0]]
          ) {
            bisection = [section[index - 1], section[index]];
          }
        });
      }
      if (bisection && bisection[1]) {
        const duration = bisection[1].time - bisection[0].time;
        const timePositionFromTime = Number(timePositionLocal) - bisection[0].time;
        const proportion = timePositionFromTime / duration;
        positionInterpolated[listValue] = {
          position: d3.interpolateNumber(bisection[0].position, bisection[1].position)(proportion),
          speed: d3.interpolateNumber(bisection[0].speed, bisection[1].speed)(proportion) * 3.6,
          time: timePositionLocal,
        };
      }
    }
  });

  return positionInterpolated;
};

export const isGET = (keyValues: string[]) => keyValues[0] === TIME;

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

export function makeTrainList(trains: Train[], trainToOffset: number, dragOffset = 0) {
  return trains.map((train) => {
    const usedOffset = trainToOffset === train.id ? dragOffset : 0;
    return trainWithDepartureAndArrivalTimes(train, usedOffset);
  });
}

export function makeTrainListWithAllTrainsOffset(trains: Train[], dragOffset = 0) {
  return trains.map((train) => trainWithDepartureAndArrivalTimes(train, dragOffset));
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
