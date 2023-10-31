import type { RootState, OsrdSlice } from 'reducers';

const buildInfraStateSelectors = (slice: OsrdSlice) => ({
  getInfraID: (state: RootState) => state[slice.name].infraID,
});

export default buildInfraStateSelectors;
