import { upperFirst, mapKeys } from 'lodash';

// eslint-disable-next-line import/prefer-default-export
export function makeEnumBooleans<T = symbol>(list: Record<string, T>, value: T | null) {
  const booleans = Object.keys(list).reduce(
    (acc, k) => ({
      ...acc,
      [k]: value === list[k],
    }),
    {}
  );
  return mapKeys(booleans, (v, k) => `is${upperFirst(k)}`);
}
