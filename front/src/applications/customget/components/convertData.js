const convertStops = (steps) => {
  let beforeStepName;
  let beforeStepTime;
  const newStepList = [];
  steps.forEach((step) => {
    if (step.label !== beforeStepName) {
      newStepList.push({
        duration: 0,
        name: step.label,
        position: step.position,
        time: step.time,
        type: step.type,
      });
    } else {
      newStepList.splice(-1);
      newStepList.push({
        duration: step.time - beforeStepTime,
        name: step.label,
        position: step.position,
        time: step.time,
        type: step.type,
      });
    }
    beforeStepName = step.label;
    beforeStepTime = step.time;
  });
  return newStepList;
};

const convertData = (trains) => {
  const newData = trains.map((train, idx) => ({
    id: idx,
    name: train.name,
    base: {
      head_positions: [
        train.space_time_curves.actual.map((step) => ({
          time: step.time,
          position: step.position,
        })),
      ],
      stops: convertStops(train.space_time_curves.time_table),
    },
  }));
  return newData;
};

export default convertData;
