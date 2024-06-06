import { convertDepartureTimeIntoSec } from 'applications/operationalStudies/utils';
import { mmToM } from 'utils/physics';
import { ms2sec } from 'utils/timeManipulation';

import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmV2SuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmSimulation: StdcmV2SuccessResponse['simulation'],
  stdcmDepartureTime: string,
  stdcmRollingStockLength: number
) => {
  const departureTimeInSec = convertDepartureTimeIntoSec(stdcmDepartureTime);
  return {
    id: STDCM_TRAIN_ID,
    trainName: 'stdcm',
    spaceTimeCurves: [
      stdcmSimulation.final_output.times.map((time, index) => ({
        // time refers to the time elapsed since departure so we need to add it to the start time
        time: departureTimeInSec + ms2sec(time),
        headPosition: mmToM(stdcmSimulation.final_output.positions[index]),
        tailPosition: mmToM(
          stdcmSimulation.final_output.positions[index] - stdcmRollingStockLength
        ),
      })),
    ],
    signal_updates: [],
    rolling_stock_length: stdcmRollingStockLength,
    departure_time: stdcmDepartureTime,
  };
};

export default formatStdcmTrainIntoSpaceTimeData;
