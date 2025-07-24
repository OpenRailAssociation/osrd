import { describe, it, expect } from 'vitest';

import {
  sortOperationalPointsFromNameAndUicSearch,
  sortOperationalPointsFromTrigramSearch,
} from '../sortOperationalPoints';

const baseOp = {
  ch: 'ch',
  ci: 1,
  geographic: { coordinates: [], type: 'Point' as const },
  infra_id: 1,
  name: 'name',
  obj_id: 'obj_id',
  track_sections: [],
  trigram: 'trigram',
  uic: 1,
};

describe('sortOperationalPointsFromTrigramSearch', () => {
  it('should return the first trigram alphabetically', () => {
    const a = { ...baseOp, trigram: 'PIY', name: 'Paris' };
    const b = { ...baseOp, trigram: 'ZUL', name: 'Lyon', uic: 0, ci: 0, ch: '00' };
    expect(sortOperationalPointsFromTrigramSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(b, a)).toEqual(1);
  });

  it('should return the first name alphabetically (case-insensitive) on identical trigram', () => {
    const a = { ...baseOp, name: 'Lyon' };
    const b = { ...baseOp, name: 'Paris', uic: 0, ci: 0, ch: '00' };
    const b2 = { ...b, name: 'paris' };
    expect(sortOperationalPointsFromTrigramSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(b, a)).toEqual(1);
    expect(sortOperationalPointsFromTrigramSearch(b2, a)).toEqual(1);
  });

  it('should prioritize MAIN_OP_CH_CODES ch when trigram and name are equal', () => {
    const a = { ...baseOp, ch: '00' };
    const a2 = { ...baseOp, ch: '' };
    const a3 = { ...baseOp, ch: 'BV' };
    const b = { ...baseOp, ch: '0', uic: 0, ci: 0 };
    expect(sortOperationalPointsFromTrigramSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(a2, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(a3, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(b, a)).toEqual(1);
  });

  it('should fall back to ch alphabetically when trigram and name are equal, and ch are not MAIN_OP_CH_CODES', () => {
    const a = { ...baseOp, ch: '0' };
    const b = { ...baseOp, ch: '01', uic: 0, ci: 0 };
    expect(sortOperationalPointsFromTrigramSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromTrigramSearch(b, a)).toEqual(1);
  });

  it('should return 0 when trigram, name and ch are equal, regardless of uic and ci', () => {
    const a = { ...baseOp };
    const b = { ...baseOp, uic: 0, ci: 0 };
    expect(sortOperationalPointsFromTrigramSearch(a, b)).toEqual(0);
  });
});

describe('sortOperationalPointsFromNameAndUicSearch', () => {
  const searchQuery = 'pa';
  const sortWithQuery = sortOperationalPointsFromNameAndUicSearch(searchQuery);

  it('should prioritize name starting with the search query (case-insensitive)', () => {
    const a = { ...baseOp, name: 'Paris', trigram: 'B' };
    const a2 = { ...a, name: 'paris' };
    const b = { ...baseOp, name: 'Lyon', trigram: 'A', uic: 0, ci: 0 };
    const b2 = { ...b, name: 'lyon' };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(a2, b)).toEqual(-1);
    expect(sortWithQuery(b2, a)).toEqual(1);
    expect(sortWithQuery(b2, a2)).toEqual(1);
  });

  it('should return the first name alphabetically if both names start with the search query', () => {
    const a = { ...baseOp, name: 'Paris Est' };
    const b = { ...baseOp, name: 'Paris Lyon', trigram: 'a', uic: 0, ci: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should return the first name alphabetically if neither names start with the search query', () => {
    const a = { ...baseOp, name: 'Lyon' };
    const b = { ...baseOp, name: 'Zurich', trigram: 'a', uic: 0, ci: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should prioritize MAIN_OP_CH_CODES ch when names are equal', () => {
    const a = { ...baseOp, ch: 'BV' };
    const a2 = { ...baseOp, ch: '' };
    const a3 = { ...baseOp, ch: '00' };
    const b = { ...baseOp, ch: 'A', trigram: 'a', uic: 0, ci: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(a2, b)).toEqual(-1);
    expect(sortWithQuery(a3, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should fall back to ch alphabetical order if name are equal and ch are not MAIN_OP_CH_CODES', () => {
    const a = { ...baseOp, ch: 'AA' };
    const b = { ...baseOp, ch: 'BB', trigram: 'a', uic: 0, ci: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should return 0 if names and ch are identical regardless of trigram, uic and ci', () => {
    const a = { ...baseOp };
    const b = { ...baseOp, uic: 0, ci: 0, trigram: 'a' };
    expect(sortWithQuery(a, b)).toEqual(0);
  });
});
