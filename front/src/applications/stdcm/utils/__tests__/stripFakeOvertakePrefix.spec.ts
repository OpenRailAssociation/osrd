import { describe, it, expect } from 'vitest';

import { stripFakeOvertakePrefix } from '..';

describe('stripFakeOvertakePrefix', () => {
  it('keeps only the operational point name after the new fake overtake prefix', () => {
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_3;Rémilly')).toBe('Rémilly');
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_2;Bourg-en-Bresse')).toBe('Bourg-en-Bresse');
  });

  it('keeps only the operational point name after a legacy overtake prefix', () => {
    expect(stripFakeOvertakePrefix('OVERTAKE_100_V7_A;Narbonne')).toBe('Narbonne');
  });

  it('leaves a regular operational point name untouched', () => {
    expect(stripFakeOvertakePrefix('Narbonne')).toBe('Narbonne');
  });
});
