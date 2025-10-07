import { upperFirst, mapKeys } from 'lodash';

export function makeEnumBooleans<T = symbol>(
  list: Record<string, T>,
  value: T | null
): Record<string, boolean> {
  const booleans = Object.keys(list).reduce<Record<string, boolean>>(
    (acc, k) => ({
      ...acc,
      [k]: value === list[k],
    }),
    {}
  );
  return mapKeys(booleans, (_, k) => `is${upperFirst(k)}`);
}
