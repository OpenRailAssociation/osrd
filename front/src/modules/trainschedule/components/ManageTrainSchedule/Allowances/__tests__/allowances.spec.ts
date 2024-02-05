import {
  fillAllowancesWithDefaultRanges,
  getFirstEmptyRange,
  getFirstEmptyRangeFromPosition,
} from '../helpers';
import { AllowanceValueForm, RangeAllowanceForm } from '../types';

const defaultAllowance: AllowanceValueForm = {
  value_type: 'percentage',
  percentage: 2,
};
const pathLength = 1000;
const allowancePercentage = (value: number) =>
  ({
    value_type: 'percentage',
    percentage: value,
  }) as AllowanceValueForm;

describe('fillAllowancesWithDefaultRanges', () => {
  it('should manage empty array', () => {
    const result = fillAllowancesWithDefaultRanges([], defaultAllowance, pathLength);
    expect(result).toEqual([]);
  });

  it('should add ranges before and after unique existing range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 200,
        end_position: 500,
        value: allowancePercentage(3),
      },
    ];
    const result = fillAllowancesWithDefaultRanges(allowances, defaultAllowance, pathLength);
    expect(result).toEqual([
      { begin_position: 0, end_position: 199, value: defaultAllowance, isDefault: true },
      { begin_position: 200, end_position: 500, value: allowancePercentage(3) },
      { begin_position: 501, end_position: 1000, value: defaultAllowance, isDefault: true },
    ]);
  });

  it('should add ranges before and after existing ranges', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 200,
        end_position: 300,
        value: allowancePercentage(3),
      },
      {
        begin_position: 700,
        end_position: 800,
        value: allowancePercentage(1),
      },
    ];
    const result = fillAllowancesWithDefaultRanges(allowances, defaultAllowance, pathLength);
    expect(result).toEqual([
      { begin_position: 0, end_position: 199, value: defaultAllowance, isDefault: true },
      { begin_position: 200, end_position: 300, value: allowancePercentage(3) },
      { begin_position: 301, end_position: 699, value: defaultAllowance, isDefault: true },
      { begin_position: 700, end_position: 800, value: allowancePercentage(1) },
      { begin_position: 801, end_position: 1000, value: defaultAllowance, isDefault: true },
    ]);
  });

  it('should not add ranges if the whole interval is covered', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 500,
        value: allowancePercentage(3),
      },
      {
        begin_position: 501,
        end_position: 1000,
        value: allowancePercentage(5),
      },
    ];
    const result = fillAllowancesWithDefaultRanges(allowances, defaultAllowance, pathLength);
    expect(result).toEqual(allowances);
  });
});

describe('getFirstEmptyRange', () => {
  it('should return the whole range if allowances is empty', () => {
    const allowances: RangeAllowanceForm[] = [];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 0, endPosition: 1000 });
  });

  it('should return the first empty range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 200,
        end_position: 500,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 0, endPosition: 199 });
  });

  it('should return the first default range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 199,
        value: defaultAllowance,
        isDefault: true,
      },
      {
        begin_position: 200,
        end_position: 500,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 0, endPosition: 199 });
  });

  it('should return the third range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 500,
        value: allowancePercentage(5),
      },
      {
        begin_position: 501,
        end_position: 850,
        value: allowancePercentage(1),
      },
      {
        begin_position: 900,
        end_position: 1000,
        value: allowancePercentage(5),
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 851, endPosition: 899 });
  });

  it('should return the last empty range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 500,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 501, endPosition: 1000 });
  });

  it('should return the last default range', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 500,
        value: allowancePercentage(3),
      },
      {
        begin_position: 501,
        end_position: 1000,
        value: defaultAllowance,
        isDefault: true,
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual({ beginPosition: 501, endPosition: 1000 });
  });

  it('should return null if the whole interval is covered', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 0,
        end_position: 500,
        value: allowancePercentage(3),
      },
      {
        begin_position: 501,
        end_position: 1000,
        value: allowancePercentage(5),
      },
    ];
    const result = getFirstEmptyRange(allowances, pathLength);
    expect(result).toEqual(null);
  });
});

describe('getFirstEmptyRangeFromPosition', () => {
  const startPosition = 650;

  it('should return the whole range if allowances is empty', () => {
    const allowances: RangeAllowanceForm[] = [];
    const result = getFirstEmptyRangeFromPosition(allowances, startPosition, pathLength);
    expect(result).toEqual({ beginPosition: 0, endPosition: 1000 });
  });

  it('should return the first range after the given position and before the first range non empty', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 850,
        end_position: 1000,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRangeFromPosition(allowances, startPosition, pathLength);
    expect(result).toEqual({ beginPosition: 650, endPosition: 849 });
  });

  it('should return the first range after the given position', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 500,
        end_position: 850,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRangeFromPosition(allowances, startPosition, pathLength);
    expect(result).toEqual({ beginPosition: 851, endPosition: 1000 });
  });

  it('should return null if no empty range after the given position', () => {
    const allowances: RangeAllowanceForm[] = [
      {
        begin_position: 500,
        end_position: 1000,
        value: allowancePercentage(3),
      },
    ];
    const result = getFirstEmptyRangeFromPosition(allowances, startPosition, pathLength);
    expect(result).toEqual(null);
  });
});
