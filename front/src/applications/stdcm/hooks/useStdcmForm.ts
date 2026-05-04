import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import {
  getLinkedTrains,
  getMaxSpeed,
  getLoadingGauge,
  getStdcmOrigin,
  getStdcmPathSteps,
  getStdcmSpeedLimitByTag,
  getTotalLength,
  getTotalMass,
  getLinkedTrainsSearchState,
} from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmSimulationInputs } from '../types';
import { getTimesInfoFromDate } from '../utils';
import useStdcmLightRollingStock from './useStdcmLightRollingStock';

const useStdcmForm = (): StdcmSimulationInputs => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getStdcmSpeedLimitByTag);
  const totalMass = useSelector(getTotalMass);
  const totalLength = useSelector(getTotalLength);
  const maxSpeed = useSelector(getMaxSpeed);
  const loadingGauge = useSelector(getLoadingGauge);
  const linkedTrains = useSelector(getLinkedTrains);
  const linkedTrainsSearchState = useSelector(getLinkedTrainsSearchState);
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
      linkedTrainsSearch: linkedTrainsSearchState,
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
    linkedTrainsSearchState,
  ]);

  return currentSimulationInputs;
};

export default useStdcmForm;
