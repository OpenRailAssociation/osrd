import { it, describe, expect } from 'vitest';

import {
  normalizeUnits,
  PRESETS,
  toFormattedValues,
  toTotalMilliseconds,
  toUnitField,
  type UnitProps,
} from '..';

const DEFAULT_PADCHAR = '0';
const DEFAULT_MAX = Infinity;

const DEFAULT_UNIT_KEYS = ['h', 'm', 's', 'ms'];
const DEFAULT_UNIT_KEYS_COMBINATIONS: string[][] = [];

for (let i = 0; i < DEFAULT_UNIT_KEYS.length; i++) {
  for (let j = i + 2; j <= DEFAULT_UNIT_KEYS.length; j++) {
    DEFAULT_UNIT_KEYS_COMBINATIONS.push(DEFAULT_UNIT_KEYS.slice(i, j));
  }
} // [['h', 'm'], ['m', 's'] ... ['h', 'm', 's']

const DEFAULT_UNITS = normalizeUnits(
  DEFAULT_UNIT_KEYS as UnitProps[],
  DEFAULT_PADCHAR,
  DEFAULT_MAX
);

describe('utils', () => {
  describe('normalizeUnits', () => {
    it.each(DEFAULT_UNIT_KEYS)(
      'should carry preset label and msPerUnit onto the output unit',
      (key) => {
        const result = normalizeUnits([key as UnitProps], DEFAULT_PADCHAR, DEFAULT_MAX);
        expect(result[0].label).toBe(PRESETS[key].label);
        expect(result[0].msPerUnit).toBe(PRESETS[key].msPerUnit);
      }
    );

    it.each(DEFAULT_UNIT_KEYS_COMBINATIONS)(
      'should set the max of a unit to the value of conversion',
      (...units) => {
        const result = normalizeUnits(units as UnitProps[], DEFAULT_PADCHAR, DEFAULT_MAX);
        result.forEach((normalizedUnit, index) => {
          const prev = index > 0 ? result[index - 1] : null;
          if (prev) {
            expect(normalizedUnit.max).toBe(Math.floor(prev.msPerUnit / normalizedUnit.msPerUnit));
          } else {
            expect(normalizedUnit.max).toBe(Math.floor(DEFAULT_MAX / normalizedUnit.msPerUnit));
          }
        });
      }
    );
    it('should accept a custom UnitConfig object', () => {
      const result = normalizeUnits(
        [{ key: 'decaSeconds', label: 'ds', msPerUnit: 10_000, digits: 1 }],
        '0',
        10_000
      );
      expect(result[0].padChar).toBe(DEFAULT_PADCHAR);
      expect(result[0].key).toBe('decaSeconds');
      expect(result[0].msPerUnit).toBe(10_000);
      expect(result[0].label).toBe('ds');
      expect(result[0].digits).toBe(1);
    });

    it('should handle mixed string presets and custom objects', () => {
      const result = normalizeUnits(
        ['h', { key: 'frames', label: 'f', msPerUnit: 40, digits: 2 }],
        '0',
        DEFAULT_MAX
      );
      expect(result.map((u) => u.key)).toEqual(['h', 'frames']);
    });
    it('should always compute digits from max for the first unit, ignoring the custom digits parameter', () => {
      const result = normalizeUnits(
        [{ key: 'decaSeconds', label: 'ds', msPerUnit: 10_000, digits: 1 }],
        '0',
        10_000_000
      );
      expect(result[0].padChar).toBe(DEFAULT_PADCHAR);
      expect(result[0].key).toBe('decaSeconds');
      expect(result[0].msPerUnit).toBe(10_000);
      expect(result[0].label).toBe('ds');
      expect(result[0].digits).toBe(4);
    });

    it('should sort units from largest to smallest msPerUnit', () => {
      const result = normalizeUnits(['ms', 'h', 's'], '0', DEFAULT_MAX);
      expect(result.map((u) => u.key)).toEqual(['h', 's', 'ms']);
    });

    it('should propagate padChar to all units', () => {
      const result = normalizeUnits(['h', 'm', 's'], '_', DEFAULT_MAX);
      result.forEach((u) => expect(u.padChar).toBe('_'));
    });

    it('should accept only a label as a custom object unit', () => {
      const result = normalizeUnits([{ label: 'h' }], DEFAULT_PADCHAR, DEFAULT_MAX);
      const preset = PRESETS['h'];

      expect(result[0].padChar).toBe(DEFAULT_PADCHAR);
      expect(result[0].key).toBe('h');
      expect(result[0].msPerUnit).toBe(preset.msPerUnit);
      expect(result[0].label).toBe('h');
      expect(result[0].digits).toBe(undefined);
    });

    it('should accept only a key as a custom object unit', () => {
      const result = normalizeUnits([{ key: 'h' }], DEFAULT_PADCHAR, DEFAULT_MAX);
      const preset = PRESETS['h'];

      expect(result[0].padChar).toBe(DEFAULT_PADCHAR);
      expect(result[0].key).toBe('h');
      expect(result[0].msPerUnit).toBe(preset.msPerUnit);
      expect(result[0].label).toBe('h');
      expect(result[0].digits).toBe(undefined);
    });
  });
  describe('toUnitField', () => {
    it('for any number, should return th corresponding unit field', () => {
      const result = toUnitField(10, {
        label: 'ms',
        key: 'ms',
        msPerUnit: 1,
        digits: 3,
        max: 20,
        padChar: '0',
      });
      expect(result).toStrictEqual(['ms', '010']);
    });

    it('for a number too high, should modulate the value at max', () => {
      const result = toUnitField(10, {
        label: 'ms',
        key: 'ms',
        msPerUnit: 1,
        digits: 3,
        max: 6,
        padChar: '0',
      });
      expect(result).toStrictEqual(['ms', '004']);
    });
  });

  describe('toFormattedValues', () => {
    it.each([
      {
        ms: 3_600_000,
        key: 'h',
      },
      {
        ms: 60_000,
        key: 'm',
      },
      {
        ms: 1_000,
        key: 's',
      },
      {
        ms: 1,
        key: 'ms',
      },
    ])('should format ($ms)ms as 1 ($key)', ({ ms, key }) => {
      const result = toFormattedValues(DEFAULT_UNITS, ms);
      const unit = DEFAULT_UNITS.find((u) => u.key === key);

      expect(unit).not.toBe(null);

      expect(result[key]).toBe(String('1').padStart(unit?.digits ?? 0, unit?.padChar));
    });
  });

  describe('toTotalMilliseconds', () => {
    it.each([
      {
        values: { h: '1', m: '0', s: '0' },
        total: 3_600_000,
      },
      {
        values: { h: '1', m: '030', s: '0' },
        total: 3_600_000 + 1_800_000,
      },
      {
        values: { h: '0', m: '0', s: '10' },
        total: 10_000,
      },
    ])('($values) should add up to ($total) milliseconds', ({ values, total }) => {
      const result = toTotalMilliseconds(
        DEFAULT_UNITS.filter((u) => Object.keys(values).includes(u.key)),
        values
      );
      expect(result).toBe(total);
    });
  });
});
