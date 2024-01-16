/**
 * constants used in the edit form of Rolling Stocks
 */
type RollingStockConstantsType = {
  [key: string]: {
    min: number;
    max: number;
    array?: string[];
  };
};
const RollingStockConstants: RollingStockConstantsType = {
  length: {
    min: 1,
    max: 6000,
  },
  mass: {
    min: 0.1,
    max: 10000,
  },
  inertiaCoefficient: {
    min: 1,
    max: 1.5,
  },
  a: {
    min: 0,
    max: 20000,
  },
  b: {
    min: 0,
    max: 500,
  },
  c: {
    min: 0,
    max: 10,
  },
  maxSpeed: {
    min: 1,
    max: 600,
  },
  startUpTime: {
    min: 0,
    max: 60,
  },
  startupAcceleration: {
    min: 0,
    max: 0.2,
  },
  comfortAcceleration: {
    min: 0,
    max: 1,
  },
  gamma: {
    min: -2,
    max: -0.01,
  },
  electricalStartupTime: {
    min: 0,
    max: 60,
  },
  raisePantographTime: {
    min: 0,
    max: 60,
  },
  speeds: {
    min: 0,
    max: 600,
  },
  efforts: {
    min: 0,
    max: 1000,
  },
};

export default RollingStockConstants;
