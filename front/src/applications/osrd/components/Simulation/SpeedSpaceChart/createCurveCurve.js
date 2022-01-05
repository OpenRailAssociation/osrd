import * as d3 from 'd3';

const createCurveCurve = (curves, speeds) => {
  const maxSpeed = d3.max(speeds.map((step) => step.speed));
  const minRadius = d3.min(curves.map((step) => step.radius));
  const maxHeight = d3.max(curves.map((step) => step.radius));
  return curves.map((step) => ({
    ...step,
    radius: (((step.radius + (minRadius * -1)) * maxSpeed) / (maxHeight + (maxHeight * -1))),
  }));
};

export default createCurveCurve;
