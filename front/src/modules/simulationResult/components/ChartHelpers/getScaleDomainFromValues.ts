/* eslint-disable import/prefer-default-export */
import * as d3 from 'd3';

import { mmToM } from 'utils/physics';

export const getScaleDomainFromValues = (values: number[]) => {
  const [minScaleValue, maxScaleValue] = d3.extent(values);
  // These values needs to be in meters
  return [mmToM(minScaleValue!), mmToM(maxScaleValue!) + 100];
};
