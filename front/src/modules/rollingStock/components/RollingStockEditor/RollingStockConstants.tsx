/**
 * constants used in the edit form of Rolling Stocks
 */
type RollingStockConstantsType = {
  [key: string]: {
    min: number;
    max: number;
    units?: Array<string>;
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
    units: ['t', 'kg'],
  },
  inertiaCoefficient: {
    min: 1,
    max: 1.5,
  },
  rollingResistanceA: {
    min: 0,
    max: 20000,
    units: ['N', 'daN', 'daN/t'],
  },
  rollingResistanceB: {
    min: 0,
    max: 500,
    units: ['N/(m/s)', 'daN/(km/h)', 'daN/(km/h)/t'],
  },
  rollingResistanceC: {
    min: 0,
    max: 10,
    units: ['N/(m/s)²', 'daN/(km/h)²', 'daN/(km/h)²/t'],
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
