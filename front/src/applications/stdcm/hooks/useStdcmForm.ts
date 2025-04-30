import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import {
  getLinkedTrains,
  getMaxSpeed,
  getLoadingGauge,
  getStdcmOrigin,
  getStdcmPathSteps,
  getStdcmRollingStockID,
  getStdcmSpeedLimitByTag,
  getTotalLength,
  getTotalMass,
} from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmSimulationInputs } from '../types';
import { getTimesInfoFromDate } from '../utils';

const useStdcmForm = (): StdcmSimulationInputs => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getStdcmSpeedLimitByTag);
  const totalMass = useSelector(getTotalMass);
  const totalLength = useSelector(getTotalLength);
  const maxSpeed = useSelector(getMaxSpeed);
  const loadingGauge = useSelector(getLoadingGauge);
  const linkedTrains = useSelector(getLinkedTrains);
  const origin = useSelector(getStdcmOrigin);
  const rollingStockId = useSelector(getStdcmRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({ rollingStockId });
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
