import { describe, it, expect } from 'vitest';

import {
  sortOperationalPointsFromNameAndUicSearch,
  sortOperationalPointsFromMainCodeSearch,
} from '../sortOperationalPoints';

const baseOp = {
  geographic: { coordinates: [], type: 'Point' as const },
  infra_id: 1,
  is_passenger_station: false,
  main_code: 'main_code',
  name: 'name',
  obj_id: 'obj_id',
  secondary_code: 'secondary_code',
  secondary_name: 'secondary_name',
  track_sections: [],
  uic: 1,
};

describe('sortOperationalPointsFromTrigramSearch', () => {
  it('should return the first main_code alphabetically', () => {
    const a = { ...baseOp, main_code: 'PIY', name: 'Paris' };
    const b = { ...baseOp, main_code: 'ZUL', name: 'Lyon', uic: 0, secondary_code: '00' };
    expect(sortOperationalPointsFromMainCodeSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(b, a)).toEqual(1);
  });

  it('should return the first name alphabetically (case-insensitive) on identical main_code', () => {
    const a = { ...baseOp, name: 'Lyon' };
    const b = { ...baseOp, name: 'Paris', uic: 0, secondary_code: '00' };
    const b2 = { ...b, name: 'paris' };
    expect(sortOperationalPointsFromMainCodeSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(b, a)).toEqual(1);
    expect(sortOperationalPointsFromMainCodeSearch(b2, a)).toEqual(1);
  });

  it('should prioritize passenger station when main code and name are equal', () => {
    const a = { ...baseOp, secondary_code: '00', is_passenger_station: true };
    const a2 = { ...baseOp, secondary_code: '', is_passenger_station: true };
    const a3 = { ...baseOp, secondary_code: 'BV', is_passenger_station: true };
    const b = { ...baseOp, secondary_code: '0', uic: 0 };
    expect(sortOperationalPointsFromMainCodeSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(a2, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(a3, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(b, a)).toEqual(1);
  });

  it('should fall back to secondary_code alphabetically when main_code and name are equal, and secondary_code are not passenger station', () => {
    const a = { ...baseOp, secondary_code: '0' };
    const b = { ...baseOp, secondary_code: '01', uic: 0 };
    expect(sortOperationalPointsFromMainCodeSearch(a, b)).toEqual(-1);
    expect(sortOperationalPointsFromMainCodeSearch(b, a)).toEqual(1);
  });

  it('should return 0 when main_code, name and secondary_code are equal, regardless of uic and ci', () => {
    const a = { ...baseOp };
    const b = { ...baseOp, uic: 0 };
    expect(sortOperationalPointsFromMainCodeSearch(a, b)).toEqual(0);
  });
});

describe('sortOperationalPointsFromNameAndUicSearch', () => {
  const searchQuery = 'pa';
  const sortWithQuery = sortOperationalPointsFromNameAndUicSearch(searchQuery);

  it('should prioritize name starting with the search query (case-insensitive)', () => {
    const a = { ...baseOp, name: 'Paris', main_code: 'B' };
    const a2 = { ...a, name: 'paris' };
    const b = { ...baseOp, name: 'Lyon', main_code: 'A', uic: 0 };
    const b2 = { ...b, name: 'lyon' };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(a2, b)).toEqual(-1);
    expect(sortWithQuery(b2, a)).toEqual(1);
    expect(sortWithQuery(b2, a2)).toEqual(1);
  });

  it('should return the first name alphabetically if both names start with the search query', () => {
    const a = { ...baseOp, name: 'Paris Est' };
    const b = { ...baseOp, name: 'Paris Lyon', main_code: 'a', uic: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should return the first name alphabetically if neither names start with the search query', () => {
    const a = { ...baseOp, name: 'Lyon' };
    const b = { ...baseOp, name: 'Zurich', main_code: 'a', uic: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should prioritize passenger station secondary_code when names are equal', () => {
    const a = { ...baseOp, secondary_code: 'BV', is_passenger_station: true };
    const a2 = { ...baseOp, secondary_code: '', is_passenger_station: true };
    const a3 = { ...baseOp, secondary_code: '00', is_passenger_station: true };
    const b = { ...baseOp, secondary_code: 'A', main_code: 'a', uic: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(a2, b)).toEqual(-1);
    expect(sortWithQuery(a3, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should fall back to secondary_code alphabetical order if name are equal and secondary_code are not passenger station', () => {
    const a = { ...baseOp, secondary_code: 'AA' };
    const b = { ...baseOp, secondary_code: 'BB', main_code: 'a', uic: 0 };
    expect(sortWithQuery(a, b)).toEqual(-1);
    expect(sortWithQuery(b, a)).toEqual(1);
  });

  it('should return 0 if names and secondary_code are identical regardless of main_code, uic and ci', () => {
    const a = { ...baseOp };
    const b = { ...baseOp, uic: 0, main_code: 'a' };
    expect(sortWithQuery(a, b)).toEqual(0);
  });

  it('should not depend on argument order', () => {
    const a = { ...baseOp, is_passenger_station: true, secondary_code: 'AA' };
    const b = { ...baseOp, is_passenger_station: true, secondary_code: 'BB' };
    expect(sortWithQuery(a, b)).toEqual(-sortWithQuery(b, a));
  });
});
