import { isNil } from 'lodash';

import type { RootState } from 'reducers';

type SubSelectorOptions = {
  nonNullable?: boolean;
};

export const makeSubSelector = <ReducerState>(rootSelector: (state: RootState) => ReducerState) => {
  function subSelector<Key extends keyof ReducerState>(
    key: Key,
    options: SubSelectorOptions & { nonNullable: true }
  ): (state: RootState) => NonNullable<ReducerState[Key]>;
  function subSelector<Key extends keyof ReducerState>(
    key: Key,
    options?: SubSelectorOptions & { nonNullable?: false }
  ): (state: RootState) => ReducerState[Key];
  function subSelector<Key extends keyof ReducerState>(
    key: Key,
    options: SubSelectorOptions = {}
  ): (state: RootState) => ReducerState[Key] {
    return (state: RootState) => {
      const val = rootSelector(state)[key];
      if (options.nonNullable && isNil(val)) {
        throw new Error(
          `Value ${key as string} of RootState is ${val}, while the selector should remain non-nullable.`
        );
      }
      return val;
    };
  }

  return subSelector;
};
