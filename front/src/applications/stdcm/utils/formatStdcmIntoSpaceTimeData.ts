import type { TrainSpaceTimeData } from 'modules/simulationResult/types';

import { STDCM_TRAIN_TIMETABLE_ID } from '../consts';
import type { StdcmSuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmResponse: StdcmSuccessResponse
): TrainSpaceTimeData => {
  const { simulation, departure_time } = stdcmResponse;
  return {
    id: STDCM_TRAIN_TIMETABLE_ID,
    name: 'stdcm',
    spaceTimeCurves: [
      {
        times: simulation.final_output.times,
        positions: simulation.final_output.positions,
      },
    ],
    signalUpdates: [],
    departureTime: new Date(departure_time),
  };
};

export default formatStdcmTrainIntoSpaceTimeData;
