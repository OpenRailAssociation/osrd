import { SNCFCOLORSONLY } from 'applications/operationalStudies/consts';

const randomColor = () => {
  const colors = Object.values(SNCFCOLORSONLY);
  const len = colors.length;
  const idx = Math.floor(Math.random() * len);
  return colors[idx];
};

const convertStops = (points) => {
  const steps = [];
  points.forEach((section) =>
    section.forEach((step) => {
      steps.push(step);
    })
  );
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
        time: beforeStepTime,
        type: step.type,
      });
    }
    beforeStepTime = step.time;
    beforeStepName = step.label;
  });
  return newStepList;
};

const convertData = (trains) => {
  const newData = trains
    .filter(
      (train) =>
        train.space_time_curves[0].points[0].length > 1 &&
        train.space_time_curves[1].points[0].length > 1
    )
    .map((train, idx) => ({
      id: idx,
      name: train.name ? train.name : train.train_metadata.name,
      color: randomColor(),
      labels: [],
      path: 0,
      vmax: [],
      slopes: [],
      curves: [],
      speeds: [],
      base: {
        head_positions: train.space_time_curves[0].points.map((section) =>
          section.map((step) => ({
            time: step.time,
            position: step.position,
          }))
        ),
        tail_positions: train.space_time_curves[1].points.map((section) =>
          section.map((step) => ({
            time: step.time,
            position: step.position,
          }))
        ),
        stops: convertStops(train.space_time_curves[0].points),
        route_begin_occupancy: [],
        route_end_occupancy: [],
        route_aspects: [],
        signals: [],
      },
    }));
  return newData;
};

export default convertData;
