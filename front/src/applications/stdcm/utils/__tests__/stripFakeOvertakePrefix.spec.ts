import { describe, it, expect } from 'vitest';

import { stripFakeOvertakePrefix } from '..';

// Names taken from the infras: fake overtake operational points start with `OVERTAKE` or
// `FAKE_OVERTAKE` and hold exactly one semicolon.
describe('stripFakeOvertakePrefix', () => {
  it('keeps only the overtaken point name', () => {
    expect(stripFakeOvertakePrefix('OVERTAKE_100_V7_A;Narbonne')).toBe('Narbonne');
    expect(stripFakeOvertakePrefix("OVERTAKE_0_V4_B;Pagny (Côte-d'Or)")).toBe("Pagny (Côte-d'Or)");
    expect(stripFakeOvertakePrefix('OVERTAKE_128_V4G_A;Les Arcs-Draguignan')).toBe(
      'Les Arcs-Draguignan'
    );
  });

  it('keeps only the overtaken point name with the FAKE_ prefix', () => {
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_270_3_B;Rémilly')).toBe('Rémilly');
    expect(stripFakeOvertakePrefix('FAKE_OVERTAKE_2_V6_B;Bourg-en-Bresse')).toBe('Bourg-en-Bresse');
  });

  it('gives the same name to both points of an overtake pair', () => {
    expect(stripFakeOvertakePrefix('OVERTAKE_104_V20G_A;Carcassonne')).toBe(
      stripFakeOvertakePrefix('OVERTAKE_104_V20G_B;Carcassonne')
    );
  });

  it('leaves a regular operational point name untouched', () => {
    expect(stripFakeOvertakePrefix('Narbonne')).toBe('Narbonne');
  });
});
