import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmSuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmResponse: StdcmSuccessResponse
): TrainSpaceTimeData => {
  const { simulation, departure_time } = stdcmResponse;
  // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
  return {
    id: formatEditoastTrainIdToTrainScheduleId(STDCM_TRAIN_ID),
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
