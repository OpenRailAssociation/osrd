import * as d3 from 'd3';

const createSlopeCurve = (slopes, referential, nameOfReferential) => {
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
  if (referential) {
    const referentialHeight = d3.max(referential.map((step) => step[nameOfReferential]))
    - d3.min(referential.map((step) => step[nameOfReferential]));
    const dataHeight = d3.max(slopesCurve.map((step) => step.height))
    - d3.min(slopesCurve.map((step) => step.height));
    return slopesCurve.map((step) => ({
      ...step,
      height: (step.height * referentialHeight) / dataHeight,
    }));
    /* return slopesCurve.map((step) => ({
      ...step,
      height: (((step.height + (minHeight * -1)) * maxReferential) / (maxHeight + (minHeight * -1))),
    })); */
  }
  return slopesCurve;
};

export default createSlopeCurve;
