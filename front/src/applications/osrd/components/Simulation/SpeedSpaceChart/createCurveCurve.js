import * as d3 from 'd3';

const createCurveCurve = (curves, referential, nameOfReferential) => {
  const referentialHeight = d3.max(referential.map((step) => step[nameOfReferential]))
  - d3.min(referential.map((step) => step[nameOfReferential]));
  const dataHeight = d3.max(curves.map((step) => step.radius))
  - d3.min(curves.map((step) => step.radius));
  return curves.map((step) => ({
    ...step,
    radius: (step.radius * referentialHeight) / dataHeight,
  }));
};

export default createCurveCurve;
