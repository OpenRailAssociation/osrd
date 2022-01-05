import * as d3 from 'd3';
import { sec2time } from 'utils/timeManipulation';
import { updateMustRedraw } from 'reducers/osrdsimulation';

export const sec2d3datetime = (time) => d3.timeParse('%H:%M:%S')(sec2time(time));

const offsetSeconds = (seconds) => {
  if (seconds > 85399) {
    return seconds - 86400;
  }
  if (seconds < 0) {
    return seconds + 86400;
  }
  return seconds;
};

export const getDirection = (data) => data[0][0].position
  < data[data.length - 1][
    data[data.length - 1].length - 1].position;

export const defineTime = (extent) => d3.scaleTime()
  .domain(extent);

export const defineLinear = (max, pctMarge = 0, origin = 0) => d3.scaleLinear()
  .domain([origin - (max * pctMarge), max + (max * pctMarge)]);

export const formatStepsWithTimeMulti = (data) => data.map(
  (section) => section.map(
    (step) => ({ time: sec2d3datetime(step.time), position: step.position }),
  ),
);

export const makeStairCase = (data) => {
  const newData = [];
  const { length } = data;
  data.forEach((step, idx) => {
    newData.push(step);
    if (idx < (length - 1)) {
      newData.push({
        time: data[idx + 1].time,
        position: step.position,
      });
    }
  });
  return newData;
};

export const formatStepsWithTime = (data) => data
  .map((step) => ({ ...step, time: sec2d3datetime(step.time) }));

export const handleWindowResize = (
  chartID, dispatch, drawTrain, isResizeActive, setResizeActive,
) => {
  if (!isResizeActive) {
    let timeOutFunctionId;
    const resizeDrawTrain = () => {
      d3.select(`#${chartID}`).remove();
      dispatch(updateMustRedraw(true));
      drawTrain();
    };
    const timeOutResize = () => {
      clearTimeout(timeOutFunctionId);
      timeOutFunctionId = setTimeout(resizeDrawTrain, 500);
    };
    window.addEventListener('resize', timeOutResize);
    setResizeActive(true);
  }
};

// Time shift a train
export const timeShiftTrain = (train, value) => ({
  ...train,
  base: {
    head_positions: train.base.head_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    tail_positions: train.base.tail_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    route_end_occupancy: train.base.route_end_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    route_begin_occupancy: train.base.route_begin_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    speeds: train.base.speeds.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    stops: train.base.stops.map(
      (stop) => ({ ...stop, time: offsetSeconds(stop.time + value) }),
    ),
  },
  margins: train.margins ? ({
    head_positions: train.margins.head_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    tail_positions: train.margins.tail_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    route_end_occupancy: train.margins.route_end_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    route_begin_occupancy: train.margins.route_begin_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    speeds: train.margins.speeds.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    stops: train.margins.stops.map(
      (stop) => ({ ...stop, time: offsetSeconds(stop.time + value) }),
    ),
  }) : null,
  eco: train.eco ? ({
    head_positions: train.eco.head_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    tail_positions: train.eco.tail_positions.map(
      (section) => section.map(
        (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
      ),
    ),
    route_end_occupancy: train.eco.route_end_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    route_begin_occupancy: train.eco.route_begin_occupancy.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    speeds: train.eco.speeds.map(
      (step) => ({ ...step, time: offsetSeconds(step.time + value) }),
    ),
    stops: train.eco.stops.map(
      (stop) => ({ ...stop, time: offsetSeconds(stop.time + value) }),
    ),
  }) : null,
});

// Merge two curves for creating area between
export const mergeDatasArea = (data1, data2, keyValues) => data1.map(
  (step, i) => ({
    [keyValues[0]]: step[keyValues[0]],
    value0: step[keyValues[1]],
    value1: data2[i][keyValues[1]],
  }),
);
export const mergeDatasArea2 = (data1, data2, keyValues) => {
  const points = [];
  data1.forEach((step, i) => {
    points.push({
      [keyValues[0]]: step[keyValues[0]],
      value0: step[keyValues[1]],
      value1: (data2 && data2[i]) ? data2[i][keyValues[1]] : 0,
    });
    points.push({
      [keyValues[0]]: data2 && data2[i] ? data2[i][keyValues[0]] : 0,
      value0: step[keyValues[1]],
      value1: data2 && data2[i] ? data2[i][keyValues[1]] : 0,
    });
    points.push({
      [keyValues[0]]: data2 && data2[i] ? data2[i][keyValues[0]] : 0,
      value0: data2 && data2[i] ? data2[i][keyValues[1]] : 0,
      value1: step[keyValues[1]],
    });
  });
  return points;
};
export const mergeDatasAreaConstant = (data1, data2, keyValues) => data1.map(
  (step) => ({
    [keyValues[0]]: step[keyValues[0]],
    value0: step[keyValues[1]],
    value1: data2,
  }),
);

// Transform little arrays of data (staircases values like emergency or indication)
// along all steps values
export const expandAndFormatData = (reference, dataToExpand) => reference.map((step) => {
  const idx = dataToExpand.findIndex((item) => item.position >= step.position);
  return {
    position: step.position,
    value: (
      (dataToExpand[idx - 1] !== undefined)
        ? dataToExpand[idx - 1].speed
        : dataToExpand[idx].speed
    ),
  };
});

export const gridX = (x, height) => (
  d3.axisBottom(x)
    .ticks(10)
    .tickSize(-height)
    .tickFormat('')
);

export const gridY = (y, width) => (
  d3.axisLeft(y)
    .ticks(10)
    .tickSize(-width)
    .tickFormat('')
);

// Interpolation of cursor based on space position
export const interpolateOnPosition = (dataSimulation, keyValues, positionLocal) => {
  const bisect = d3.bisector((d) => d[keyValues[0]]).left;
  const index = bisect(dataSimulation.speed, positionLocal, 1);
  const bisection = [dataSimulation.speed[index - 1], dataSimulation.speed[index]];
  if (bisection[1]) {
    const distance = bisection[1].position - bisection[0].position;
    const distanceFromPosition = positionLocal - bisection[0].position;
    const proportion = distanceFromPosition / distance;
    return sec2d3datetime(d3.interpolateNumber(
      bisection[0].time, bisection[1].time,
    )(proportion));
  }
  return false;
};

// Interpolation of cursor based on time position
export const interpolateOnTime = (dataSimulation, keyValues, listValues, timePositionLocal) => {
  const bisect = d3.bisector((d) => d[keyValues[0]]).left;
  const positionInterpolated = {};
  listValues.forEach((listValue) => {
    let bisection;
    // For array of arrays
    if (listValue === 'headPosition'
    || listValue === 'head_positions'
    || listValue === 'tailPosition'
    || listValue === 'margins_headPosition'
    || listValue === 'eco_headPosition'
    ) {
      if (dataSimulation[listValue]) {
        dataSimulation[listValue].forEach((section) => {
          const index = bisect(section, timePositionLocal, 1);
          if (index !== section.length && timePositionLocal >= section[0][keyValues[0]]) {
            bisection = [section[index - 1], section[index]];
          }
        });
      }
    } else if (dataSimulation[listValue]
      && timePositionLocal >= dataSimulation[listValue][0][keyValues[0]]) {
      const index = bisect(dataSimulation[listValue], timePositionLocal, 1);
      bisection = [dataSimulation[listValue][index - 1], dataSimulation[listValue][index]];
    }
    if (bisection && bisection[1]) {
      const duration = bisection[1].time - bisection[0].time;
      const timePositionFromTime = timePositionLocal - bisection[0].time;
      const proportion = timePositionFromTime / duration;
      positionInterpolated[listValue] = {
        position: d3.interpolateNumber(
          bisection[0].position, bisection[1].position,
        )(proportion),
        speed: d3.interpolateNumber(
          bisection[0].speed, bisection[1].speed,
        )(proportion) * 3.6,
        time: timePositionLocal,
      };
    }
  });
  return positionInterpolated;
};
