import type { PathProperties } from 'common/api/generatedEditoastApi';

import getPathVoltages from '../getPathVoltages';

const pathLength = 10;

describe('getPathVoltages', () => {
  it('should return 1 range if 1500V - neutral - 1500V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [4, 6],
      values: [
        { type: 'electrification', voltage: '1500V' },
        { type: 'neutral_section', lower_pantograph: true },
        { type: 'electrification', voltage: '1500V' },
      ],
    };

    const expectedResult = [{ begin: 0, end: 10, value: '1500V' }];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 3 ranges if 1500V - neutral - 25000V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [4, 6],
      values: [
        { type: 'electrification', voltage: '1500V' },
        { type: 'neutral_section', lower_pantograph: true },
        { type: 'electrification', voltage: '25000V' },
      ],
    };

    const expectedResult = [
      { begin: 0, end: 4, value: '1500V' },
      { begin: 4, end: 6, value: '' },
      { begin: 6, end: 10, value: '25000V' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 3 ranges if 1500V - non electrified - 25000V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [4, 6],
      values: [
        { type: 'electrification', voltage: '1500V' },
        { type: 'non_electrified' },
        { type: 'electrification', voltage: '25000V' },
      ],
    };

    const expectedResult = [
      { begin: 0, end: 4, value: '1500V' },
      { begin: 4, end: 6, value: '' },
      { begin: 6, end: 10, value: '25000V' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 3 ranges if 1500V - non electrified - 1500V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [4, 6],
      values: [
        { type: 'electrification', voltage: '1500V' },
        { type: 'non_electrified' },
        { type: 'electrification', voltage: '1500V' },
      ],
    };

    const expectedResult = [
      { begin: 0, end: 4, value: '1500V' },
      { begin: 4, end: 6, value: '' },
      { begin: 6, end: 10, value: '1500V' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 2 ranges if non electrified - 1500V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [5],
      values: [{ type: 'non_electrified' }, { type: 'electrification', voltage: '1500V' }],
    };

    const expectedResult = [
      { begin: 0, end: 5, value: '' },
      { begin: 5, end: 10, value: '1500V' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 2 ranges if neutral - non electrified - 1500V', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [2, 5],
      values: [
        { type: 'neutral_section', lower_pantograph: true },
        { type: 'non_electrified' },
        { type: 'electrification', voltage: '1500V' },
      ],
    };

    const expectedResult = [
      { begin: 0, end: 5, value: '' },
      { begin: 5, end: 10, value: '1500V' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });

  it('should return 3 ranges if non electrified - 1500V - neutral', () => {
    const electrifications: NonNullable<PathProperties['electrifications']> = {
      boundaries: [2, 8],
      values: [
        { type: 'non_electrified' },
        { type: 'electrification', voltage: '1500V' },
        { type: 'neutral_section', lower_pantograph: true },
      ],
    };

    const expectedResult = [
      { begin: 0, end: 2, value: '' },
      { begin: 2, end: 8, value: '1500V' },
      { begin: 8, end: 10, value: '' },
    ];

    const result = getPathVoltages(electrifications, pathLength);
    expect(result).toEqual(expectedResult);
  });
});
