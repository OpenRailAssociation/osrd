import * as d3 from 'd3';

const getScaleDomainFromValues = (values: number[]) => {
  const [minScaleValue, maxScaleValue] = d3.extent(values) as number[];
  return [minScaleValue, maxScaleValue + 100];
};

export default getScaleDomainFromValues;
