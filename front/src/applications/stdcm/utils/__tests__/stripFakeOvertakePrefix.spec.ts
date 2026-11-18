import { describe, it, expect } from 'vitest';

import { stripFakeOvertakePrefix } from '..';

describe('stripFakeOvertakePrefix', () => {
  it('keeps only the operational point name after the new fake overtake prefix', () => {
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_V7;Narbonne')).toBe('Narbonne');
    expect(stripFakeOvertakePrefix("FAKE_OVERTAKE_V4;Pagny (Côte-d'Or)")).toBe("Pagny (Côte-d'Or)");
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_V4G;Les Arcs-Draguignan')).toBe(
      'Les Arcs-Draguignan'
    );
  });

  it('leaves a regular operational point name untouched', () => {
    expect(stripFakeOvertakePrefix('Narbonne')).toBe('Narbonne');
  });
});
