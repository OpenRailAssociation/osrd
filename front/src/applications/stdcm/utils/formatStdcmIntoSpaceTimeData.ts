import type { TrainSpaceTimeData } from 'modules/simulationResult/types';

import { STDCM_TRAIN_ID } from '../consts';
import type { StdcmSuccessResponse } from '../types';

const formatStdcmTrainIntoSpaceTimeData = (
  stdcmResponse: StdcmSuccessResponse
): TrainSpaceTimeData => {
  const { simulation, departure_time, simulationPathSteps } = stdcmResponse;
  const origin = simulationPathSteps.at(0);
  const destination = simulationPathSteps.at(-1);

  if (!origin?.operationalPoint) throw new Error('Origin point not defined');
  if (!destination?.operationalPoint) throw new Error('Origin point not defined');

  return {
    id: STDCM_TRAIN_ID,
    name: 'stdcm',
    originPathItem: {
      id: origin.id,
      location: {
        operational_point: {
          type: 'uic',
          uic: origin.operationalPoint.uic,
          secondary_code: origin.operationalPoint.secondaryCode,
        },
      },
    },
    destinationPathItem: {
      id: destination.id,
      location: {
        operational_point: {
          type: 'uic',
          uic: destination.operationalPoint.uic,
          secondary_code: destination.operationalPoint.secondaryCode,
        },
      },
    },
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
