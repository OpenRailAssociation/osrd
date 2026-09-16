import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import {
  getLinkedTrains,
  getStdcmOrigin,
  getStdcmPathSteps,
} from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmSimulationInputs } from '../types';
import { getTimesInfoFromDate } from '../utils';
import useStdcmLightRollingStock from './useStdcmLightRollingStock';

const useStdcmForm = (): StdcmSimulationInputs => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = pathSteps[0].consist?.speedLimitByTag;
  const totalMass = pathSteps[0].consist?.totalMass;
  const totalLength = pathSteps[0].consist?.totalLength;
  const maxSpeed = pathSteps[0].consist?.maxSpeed;
  const loadingGauge = pathSteps[0].consist?.loadingGauge;
  const linkedTrains = useSelector(getLinkedTrains);
  const origin = useSelector(getStdcmOrigin);
  const rollingStock = useStdcmLightRollingStock();
  const towedRollingStock = useStdcmTowedRollingStock();

  const currentSimulationInputs = useMemo(() => {
    const originArrival = getTimesInfoFromDate(origin.arrival);

    return {
      pathSteps,
      departureDate: originArrival?.arrivalDate,
      departureTime: originArrival?.arrivalTime,
      consist: {
        tractionEngine: rollingStock,
        towedRollingStock,
        totalMass,
        totalLength,
        maxSpeed,
        loadingGauge,
        speedLimitByTag,
      },
      linkedTrains,
    };
  }, [
    pathSteps,
    rollingStock,
    towedRollingStock,
    speedLimitByTag,
    totalMass,
    totalLength,
    maxSpeed,
    loadingGauge,
    linkedTrains,
  ]);

  return currentSimulationInputs;
};

export default useStdcmForm;
