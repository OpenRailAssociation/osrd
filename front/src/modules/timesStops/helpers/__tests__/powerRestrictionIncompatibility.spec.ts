import { describe, it, expect } from 'vitest';

import type { TimesStopsRowNew } from '../../types';
import { computeRowPowerRestrictionStatus } from '../powerRestrictionIncompatibility';

/** Build a minimal row with only the fields used by computeRowPowerRestrictionStatus. */
const row = (
  id: string,
  opOnPathIndex: number,
  opts: { isPathStep?: boolean; powerRestriction?: string | null } = {}
): TimesStopsRowNew =>
  ({
    id,
    opOnPathIndex,
    isPathStep: opts.isPathStep ?? false,
    powerRestriction: opts.powerRestriction ?? null,
  }) as TimesStopsRowNew;

describe('computeRowPowerRestrictionStatus', () => {
  it('returns empty map for empty rows', () => {
    const result = computeRowPowerRestrictionStatus([], new Map(), [], []);
    expect(result.size).toBe(0);
  });

  it('marks no warnings when there are no warning ranges', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
    ]);

    const result = computeRowPowerRestrictionStatus(rows, positions, [], []);

    expect(result.get('a')?.hasWarning).toBe(false);
    expect(result.get('b')?.hasWarning).toBe(false);
    expect(result.get('c')?.hasWarning).toBe(false);
  });

  it('marks a multi-row block as incompatible', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2), row('d', 3)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
      [3, 400],
    ]);
    const warningRanges = [{ begin: 150, end: 350 }];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, []);

    expect(result.get('a')?.hasWarning).toBe(false);
    expect(result.get('b')?.hasWarning).toBe(true);
    expect(result.get('b')?.isBlockStart).toBe(true);
    expect(result.get('c')?.hasWarning).toBe(true);
    expect(result.get('c')?.isBlockStart).toBe(false);
    expect(result.get('d')?.hasWarning).toBe(false);
  });

  it('dismisses single-row blocks in electrification transition zones', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
    ]);
    // Warning range covers only row b
    const warningRanges = [{ begin: 150, end: 250 }];
    // Row b falls within a transition zone (voltage = "")
    const voltages = [
      { begin: 0, end: 180, value: '1500V' },
      { begin: 180, end: 220, value: '' },
      { begin: 220, end: 500, value: '25000V' },
    ];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, voltages);

    // Row b should be dismissed (single-row block in transition zone)
    expect(result.get('a')?.hasWarning).toBe(false);
    expect(result.get('b')?.hasWarning).toBe(false);
    expect(result.get('b')?.isBlockStart).toBe(false);
    expect(result.get('c')?.hasWarning).toBe(false);
  });

  it('keeps single-row blocks outside electrification transition zones', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
    ]);
    // Warning range covers only row b
    const warningRanges = [{ begin: 150, end: 250 }];
    // Row b is in a real voltage zone (not a transition)
    const voltages = [{ begin: 0, end: 500, value: '1500V' }];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, voltages);

    // Row b should NOT be dismissed (real incompatibility, not a transition)
    expect(result.get('b')?.hasWarning).toBe(true);
    expect(result.get('b')?.isBlockStart).toBe(true);
  });

  it('dismisses single-row block at the end of the table in transition zone', () => {
    const rows = [row('a', 0), row('b', 1)];
    const positions = new Map([
      [0, 100],
      [1, 200],
    ]);
    // Warning range covers only the last row
    const warningRanges = [{ begin: 150, end: 300 }];
    // Last row is in a transition zone
    const voltages = [
      { begin: 0, end: 180, value: '1500V' },
      { begin: 180, end: 300, value: '' },
    ];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, voltages);

    expect(result.get('a')?.hasWarning).toBe(false);
    expect(result.get('b')?.hasWarning).toBe(false);
    expect(result.get('b')?.isBlockStart).toBe(false);
  });

  it('propagates the active restriction along the rows', () => {
    const rows = [
      row('a', 0, { isPathStep: true, powerRestriction: 'C1US' }),
      row('b', 1),
      row('c', 2, { isPathStep: true, powerRestriction: 'M1US' }),
      row('d', 3),
    ];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
      [3, 400],
    ]);

    const result = computeRowPowerRestrictionStatus(rows, positions, [], []);

    expect(result.get('a')?.propagatedValue).toBe('C1US');
    expect(result.get('b')?.propagatedValue).toBe('C1US');
    expect(result.get('c')?.propagatedValue).toBe('M1US');
    expect(result.get('d')?.propagatedValue).toBe('M1US');
  });

  it('NO_POWER_RESTRICTION resets the propagated value to null', () => {
    const rows = [
      row('a', 0, { isPathStep: true, powerRestriction: 'C1US' }),
      row('b', 1),
      row('c', 2, {
        isPathStep: true,
        powerRestriction: 'NO_POWER_RESTRICTION',
      }),
      row('d', 3),
    ];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
      [3, 400],
    ]);

    const result = computeRowPowerRestrictionStatus(rows, positions, [], []);

    expect(result.get('a')?.propagatedValue).toBe('C1US');
    expect(result.get('b')?.propagatedValue).toBe('C1US');
    expect(result.get('c')?.propagatedValue).toBeNull();
    expect(result.get('d')?.propagatedValue).toBeNull();
  });

  it('non-pathStep rows do not reset the propagated value', () => {
    const rows = [
      row('a', 0, { isPathStep: true, powerRestriction: 'C1US' }),
      row('b', 1, { isPathStep: false, powerRestriction: null }),
      row('c', 2),
    ];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
    ]);

    const result = computeRowPowerRestrictionStatus(rows, positions, [], []);

    expect(result.get('b')?.propagatedValue).toBe('C1US');
    expect(result.get('c')?.propagatedValue).toBe('C1US');
  });

  it('detects multiple separate blocks', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2), row('d', 3), row('e', 4), row('f', 5)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
      [3, 400],
      [4, 500],
      [5, 600],
    ]);
    // Two separate warning ranges
    const warningRanges = [
      { begin: 150, end: 350 }, // covers b, c
      { begin: 450, end: 650 }, // covers e, f
    ];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, []);

    expect(result.get('a')?.hasWarning).toBe(false);
    expect(result.get('b')?.hasWarning).toBe(true);
    expect(result.get('b')?.isBlockStart).toBe(true);
    expect(result.get('c')?.hasWarning).toBe(true);
    expect(result.get('c')?.isBlockStart).toBe(false);
    expect(result.get('d')?.hasWarning).toBe(false);
    expect(result.get('e')?.hasWarning).toBe(true);
    expect(result.get('e')?.isBlockStart).toBe(true);
    expect(result.get('f')?.hasWarning).toBe(true);
    expect(result.get('f')?.isBlockStart).toBe(false);
  });

  it('uses semi-open interval: begin is inclusive, end is exclusive', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2), row('d', 3)];
    const positions = new Map([
      [0, 100],
      [1, 200],
      [2, 300],
      [3, 400],
    ]);
    // Row at position 200 should be IN (>= begin), row at 400 should be OUT (< end)
    const warningRanges = [{ begin: 200, end: 400 }];

    const result = computeRowPowerRestrictionStatus(rows, positions, warningRanges, []);

    expect(result.get('a')?.hasWarning).toBe(false); // 100 < 200
    expect(result.get('b')?.hasWarning).toBe(true); // 200 >= 200
    expect(result.get('c')?.hasWarning).toBe(true); // 300 >= 200 && < 400
    expect(result.get('d')?.hasWarning).toBe(false); // 400 not < 400
  });
});
