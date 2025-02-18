import type { RootState, OsrdSlice } from 'reducers';

export type InfraStateSelectors<Name extends string> = {
  [P in `get${Name}InfraID`]: (state: RootState) => number | undefined;
};

/**
 * This function builds a predefined collection of selectors on a given slice. It is possible to add
 * a name so that the selectors have custom names, to clarify how to use them later.
 *
 * For instance, you can use it as:
 * - `buildInfraStateSelectors(someSlice).getStdcmID`
 * - `buildInfraStateSelectors(someSlice, 'Stdcm').getStdcmStdcmID`
 */
function buildInfraStateSelectors(slice: OsrdSlice): InfraStateSelectors<''>;
function buildInfraStateSelectors<Name extends string>(
  slice: OsrdSlice,
  name: Name
): InfraStateSelectors<Name>;
function buildInfraStateSelectors<Name extends string>(
  slice: OsrdSlice,
  name?: Name
): InfraStateSelectors<Name> {
  return {
    [`get${name || ''}InfraID`]: (state: RootState) => state[slice.name].infraID,
  } as InfraStateSelectors<Name>;
}

export default buildInfraStateSelectors;
