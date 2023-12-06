import * as d3 from 'd3';
import { defineLinear } from './ChartHelpers';

const getScaleDomainFromValues = (values: number[]) => {
  const maxX = d3.max(values) as number;
  const scaleX = defineLinear(maxX + 100);
  return scaleX.domain();
};

export default getScaleDomainFromValues;
