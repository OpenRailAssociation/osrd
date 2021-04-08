import * as d3 from 'd3';

export const sec2time = (time) => {
  time = Number(time);
  const h = `0${Math.floor(time / 3600)}`.slice(-2);
  const m = `0${Math.floor((time % 3600) / 60)}`.slice(-2);
  const s = `0${Math.floor((time % 3600) % 60)}`.slice(-2);
  return d3.timeParse('%H:%M:%S')(`${h}:${m}:${s}`);
};

const addSeconds = (dateOrig, seconds) => {
  const date = new Date(`2021-01-01 ${dateOrig}`);
  return new Date(date.getTime() + (seconds * 1000)).toLocaleTimeString();
};

const offsetSeconds = (seconds) => {
  if (seconds > 85399) {
    return seconds - 86400;
  }
  if (seconds < 0) {
    return seconds + 86400;
  }
  return seconds;
};

export const defineTime = (extent) => d3.scaleTime()
  .domain(extent);

export const defineLinear = (max, pctMarge = 0) => d3.scaleLinear()
  .domain([0 - (max * pctMarge), max + (max * pctMarge)]);

export const formatStepsWithTime = (train, valueName) => train.steps
  .map((step) => ({ time: sec2time(step.time), value: step[valueName] }));

export const formatStepsWithSpace = (
  multiplier, train, valueName,
) => train.steps
  .map((step) => ({ space: step.headPosition, value: step[valueName] * multiplier }));

export const formatData = (trains, trainNumber, dataName) => trains[trainNumber][dataName]
  .map((step) => ({ space: step.space, value: step.speed }));

export const handleWindowResize = (chartID, drawTrain, isResizeActive, setResizeActive, setMustRedraw) => {
  if (!isResizeActive) {
    let timeOutFunctionId;
    const resizeDrawTrain = () => {
      d3.select(`#${chartID}`).remove();
      setMustRedraw(true);
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

// Time shift a train to duplicate usage
export const timeShiftTrain = (steps, value) => steps
  .map((step) => ({ ...step, time: offsetSeconds(step.time + value) }));
export const timeShiftStops = (stops, value) => stops
  .map((stop) => ({ ...stop, time: addSeconds(stop.time, value) }));

// Simplify data, 50% by default
export const simplifyData = (simulationTrains, factor = 2) => simulationTrains.map((train) => {
  if (factor > 0) {
    const newSteps = [];
    for (let idx = 0; idx < train.steps.length; idx += factor) {
      newSteps.push(train.steps[idx]);
    }
    return { ...train, steps: newSteps };
  }
  return train;
});

// Merge two curves for creating area between
export const mergeDatasArea = (data1, data2, keyValues) => data1.map(
  (step, i) => ({
    [keyValues[0]]: step[keyValues[0]],
    value0: step[keyValues[1]],
    value1: (data2 !== undefined) ? data2[i][keyValues[1]] : 0,
  }),
);

// Transform little arrays of data (staircases values like emergency or indication)
// along all steps values
export const expandAndFormatData = (reference, dataToExpand) => reference.map((step) => {
  const idx = dataToExpand.findIndex((item) => item.space >= step.space);
  return {
    space: step.space,
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
