import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import { extractDateAndTimefromISO } from 'utils/date';

import type { StdcmSimulationInputs } from '../types';

const useStdcmForm = (): StdcmSimulationInputs => {
  const { getStdcmPathSteps, getSpeedLimitByTag } = useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const currentSimulationInputs = useMemo(() => {
    const origin = pathSteps.at(0);
    const originArrival = origin?.arrival ? extractDateAndTimefromISO(origin.arrival) : undefined;

    return {
      pathSteps,
      departureDate: originArrival?.arrivalDate,
      departureTime: originArrival?.arrivalTime,
      consist: {
        tractionEngine: rollingStock,
        speedLimitByTag,
      },
    };
  }, [pathSteps, rollingStock, speedLimitByTag]);

  return currentSimulationInputs;
};

export default useStdcmForm;
