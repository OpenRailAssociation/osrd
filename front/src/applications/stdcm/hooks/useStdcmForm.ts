import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import useStdcmTowedRollingStock from 'applications/stdcm/hooks/useStdcmTowedRollingStock';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import {
  getLinkedTrains,
  getMaxSpeed,
  getStdcmOrigin,
  getStdcmPathSteps,
  getTotalLength,
  getTotalMass,
} from 'reducers/osrdconf/stdcmConf/selectors';

import type { StdcmSimulationInputs } from '../types';
import { getTimesInfoFromDate } from '../utils';

const useStdcmForm = (): StdcmSimulationInputs => {
  const { getSpeedLimitByTag } = useOsrdConfSelectors();

  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const totalMass = useSelector(getTotalMass);
  const totalLength = useSelector(getTotalLength);
  const maxSpeed = useSelector(getMaxSpeed);
  const linkedTrains = useSelector(getLinkedTrains);
  const origin = useSelector(getStdcmOrigin);
  const { rollingStock } = useStoreDataForRollingStockSelector();
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
    linkedTrains,
  ]);

  return currentSimulationInputs;
};

export default useStdcmForm;
