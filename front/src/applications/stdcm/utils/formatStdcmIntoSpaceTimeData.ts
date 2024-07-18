import type { ProjectPathTrainResult } from 'common/api/generatedEditoastApi';

import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmV2SuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmSimulation: StdcmV2SuccessResponse['simulation'],
  stdcmDepartureTime: string,
  stdcmRollingStockLength: number
): ProjectPathTrainResult & { id: number; trainName: string } => ({
  id: STDCM_TRAIN_ID,
  trainName: 'stdcm',
  space_time_curves: [
    {
      times: stdcmSimulation.final_output.times,
      positions: stdcmSimulation.final_output.positions,
    },
  ],
  signal_updates: [],
  rolling_stock_length: stdcmRollingStockLength,
  departure_time: stdcmDepartureTime,
});

export default formatStdcmTrainIntoSpaceTimeData;
