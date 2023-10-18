import { RootState } from 'reducers';
import { stdcmConfSlice } from '.';
import buildCommonConfSelectors from '../common/selectors';

const selectors = {
  ...buildCommonConfSelectors(stdcmConfSlice),
  getStdcmMode: (state: RootState) => state[stdcmConfSlice.name].stdcmMode,
  getStandardStdcmAllowance: (state: RootState) =>
    state[stdcmConfSlice.name].standardStdcmAllowance,
  getMaximumRunTime: (state: RootState) => state[stdcmConfSlice.name].maximumRunTime,
};

export type stdcmConfSelectorsType = typeof selectors;

export default selectors;
