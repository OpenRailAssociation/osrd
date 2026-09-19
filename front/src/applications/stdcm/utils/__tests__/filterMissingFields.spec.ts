import { describe, it, expect } from 'vitest';

import { ArrivalTimeTypes, StdcmStopTypes } from 'applications/stdcm/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import filterMissingFields from '../filterMissingFields';

describe('filterMissingFields', () => {
  const makePathStep = (hasOP = true): StdcmPathStep => ({
    id: 'step',
    isVia: false,
    arrivalType: ArrivalTimeTypes.ASAP,
    tolerances: { before: new Duration({ seconds: 0 }), after: new Duration({ seconds: 0 }) },
    ...(hasOP && {
      operationalPoint: {
        id: 'op1',
        countryCode: 'FR',
        mainCode: 'ABC',
        uic: 12345,
        secondaryCode: '00',
        name: 'Station A',
        coordinates: [0, 0],
      },
    }),
  });

  const makeViaStep = (totalMass?: number, totalLength?: number, hasOP = true): StdcmPathStep => ({
    id: 'via',
    isVia: true,
    stopType: StdcmStopTypes.SERVICE_STOP,
    consist: { totalMass, totalLength },
    ...(hasOP && {
      operationalPoint: {
        id: 'op2',
        countryCode: 'FR',
        mainCode: 'DEF',
        uic: 67890,
        secondaryCode: '00',
        name: 'Station B',
        coordinates: [1, 1],
      },
    }),
  });

  describe('checkAllFields mode', () => {
    it('returns [] when checkAllFields is false and missingFields is undefined', () => {
      const result = filterMissingFields({});
      expect(result).toEqual([]);
    });

    it('returns only the missingFields entries that are actually missing', () => {
      const pathStep = makePathStep();

      pathStep.consist = { rollingStockID: 1 };

      const result = filterMissingFields({
        missingFields: ['tractionEngine', 'totalMass'],
        vias: [pathStep],
      });
      expect(result).toEqual(['totalMass']);
    });

    it('returns all fields when checkAllFields is true and nothing is provided', () => {
      const pathStep = makePathStep();
      pathStep.consist = {};

      const result = filterMissingFields({ checkAllFields: true, vias: [pathStep] });
      expect(result).toEqual([
        'tractionEngine',
        'totalMass',
        'totalLength',
        'maxSpeed',
        'origin',
        'destination',
      ]);
    });

    it('returns [] when checkAllFields is true and all fields are valid', () => {
      const pathStep = makePathStep();

      pathStep.consist = {
        rollingStockID: 1,
        totalMass: 100,
        totalLength: 200,
        maxSpeed: 80,
      };

      const result = filterMissingFields({
        checkAllFields: true,
        origin: makePathStep(),
        vias: [pathStep],
        destination: makePathStep(),
      });
      expect(result).toEqual([]);
    });
  });

  describe('tractionEngine', () => {
    it('is missing when rollingStockID is undefined', () => {
      const pathStep = makePathStep();
      pathStep.consist = {};

      const result = filterMissingFields({
        missingFields: ['tractionEngine'],
        vias: [pathStep],
      });
      expect(result).toEqual(['tractionEngine']);
    });

    it('is not missing when rollingStockID is a positive number', () => {
      const result = filterMissingFields({
        missingFields: ['tractionEngine'],
        rollingStockID: 42,
      });
      expect(result).toEqual([]);
    });
  });

  describe('totalMass / totalLength / maxSpeed (strict undefined check)', () => {
    it('are missing when values are undefined', () => {
      const pathStep = makePathStep();
      pathStep.consist = {};

      const result = filterMissingFields({
        missingFields: ['totalMass', 'totalLength', 'maxSpeed'],
        vias: [pathStep],
      });
      expect(result).toEqual(['totalMass', 'totalLength', 'maxSpeed']);
    });

    it('are not missing when values are 0', () => {
      const result = filterMissingFields({
        missingFields: ['totalMass', 'totalLength', 'maxSpeed'],
        totalMass: 0,
        totalLength: 0,
        maxSpeed: 0,
      });
      expect(result).toEqual([]);
    });
  });

  describe('origin', () => {
    it('is missing when origin is undefined', () => {
      const result = filterMissingFields({ missingFields: ['origin'] });
      expect(result).toEqual(['origin']);
    });

    it('is missing when origin has no operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['origin'],
        origin: makePathStep(false),
      });
      expect(result).toEqual(['origin']);
    });

    it('is not missing when origin has an operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['origin'],
        origin: makePathStep(),
      });
      expect(result).toEqual([]);
    });
  });

  describe('destination', () => {
    it('is missing when destination is undefined', () => {
      const result = filterMissingFields({ missingFields: ['destination'] });
      expect(result).toEqual(['destination']);
    });

    it('is missing when destination has no operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['destination'],
        destination: makePathStep(false),
      });
      expect(result).toEqual(['destination']);
    });

    it('is not missing when destination has an operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['destination'],
        destination: makePathStep(),
      });
      expect(result).toEqual([]);
    });
  });

  describe('vias', () => {
    it('is not flagged when vias is undefined', () => {
      const result = filterMissingFields({ missingFields: ['vias'] });
      expect(result).toEqual([]);
    });

    it('is not missing when all vias have an operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['vias'],
        vias: [makeViaStep(100, 200)],
      });
      expect(result).toEqual([]);
    });

    it('is missing when any via lacks an operationalPoint', () => {
      const result = filterMissingFields({
        missingFields: ['vias'],
        vias: [makeViaStep(100, 200), makeViaStep(100, 200, false)],
      });
      expect(result).toEqual(['vias']);
    });
  });

  describe('totalMass on via', () => {
    it('is not flagged when vias is undefined', () => {
      const result = filterMissingFields({ missingFields: ['totalMass'] });
      expect(result).toEqual([]);
    });

    it('is not missing when all isVia steps have totalMass set (including 0)', () => {
      const result = filterMissingFields({
        missingFields: ['totalMass'],
        vias: [makeViaStep(0, 200)],
      });
      expect(result).toEqual([]);
    });

    it('is missing when any isVia step has totalMass undefined', () => {
      const result = filterMissingFields({
        missingFields: ['totalMass'],
        vias: [makeViaStep(undefined, 200)],
      });
      expect(result).toEqual(['totalMass']);
    });
  });

  describe('totalLength on via', () => {
    it('is not flagged when vias is undefined', () => {
      const result = filterMissingFields({ missingFields: ['totalLength'] });
      expect(result).toEqual([]);
    });

    it('is not missing when all isVia steps have totalLength set (including 0)', () => {
      const result = filterMissingFields({
        missingFields: ['totalLength'],
        vias: [makeViaStep(100, 0)],
      });
      expect(result).toEqual([]);
    });

    it('is missing when any isVia step has totalLength undefined', () => {
      const result = filterMissingFields({
        missingFields: ['totalLength'],
        vias: [makeViaStep(100, undefined)],
      });
      expect(result).toEqual(['totalLength']);
    });
  });
});
