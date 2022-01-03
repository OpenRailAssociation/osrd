import * as d3 from 'd3';

const createSlopeCurve = (slopes, speeds) => {
  const slopesCurve = [];
  slopes.forEach(
    (step, idx) => {
      if (idx % 2 === 0 && slopes[idx + 1]) {
        if (idx === 0) {
          slopesCurve.push({ height: 0, position: step.position });
        } else {
          const distance = step.position - slopesCurve[
            slopesCurve.length - 1].position;
          const height = ((distance * slopes[idx - 2].gradient)
            / 1000) + slopesCurve[slopesCurve.length - 1].height;
          slopesCurve.push({ height, position: step.position });
        }
      }
    },
  );
  const maxSpeed = d3.max(speeds.map((step) => step.speed));
  const minHeight = d3.min(slopesCurve.map((step) => step.height));
  const maxHeight = d3.max(slopesCurve.map((step) => step.height));
  return slopesCurve.map((step) => ({
    ...step,
    height: (((step.height + (minHeight * -1)) * maxSpeed) / (maxHeight + (minHeight * -1))),
  }));
};

export default createSlopeCurve;
