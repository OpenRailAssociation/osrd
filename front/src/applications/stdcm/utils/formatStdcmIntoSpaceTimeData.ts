import type { ProjectPathTrainResult } from 'common/api/osrdEditoastApi';

import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmV2SuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmResponse: StdcmV2SuccessResponse
): ProjectPathTrainResult & { id: number; name: string } => {
  const { simulation, rollingStock, departure_time } = stdcmResponse;
  return {
    id: STDCM_TRAIN_ID,
    name: 'stdcm',
    space_time_curves: [
      {
        times: simulation.final_output.times,
        positions: simulation.final_output.positions,
      },
    ],
    signal_updates: [],
    rolling_stock_length: rollingStock.length,
    departure_time,
  };
};

export default formatStdcmTrainIntoSpaceTimeData;
