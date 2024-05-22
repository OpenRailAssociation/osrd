import * as d3 from 'd3';

import { mmToM } from 'utils/physics';

const getScaleDomainFromValues = (values: number[]) => {
  const [minScaleValue, maxScaleValue] = d3.extent(values) as number[];
  return [minScaleValue, maxScaleValue + 100];
};

export const getScaleDomainFromValuesV2 = (values: number[]) => {
  const [minScaleValue, maxScaleValue] = d3.extent(values) as number[];
  // These values needs to be in meters
  return [mmToM(minScaleValue), mmToM(maxScaleValue) + 100];
};

export default getScaleDomainFromValues;
