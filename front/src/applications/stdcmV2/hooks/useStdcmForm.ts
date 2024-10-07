import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useOsrdConfSelectors } from 'common/osrdContext';
import type { StdcmSimulationInputs } from '../types';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import useStoreDataForRollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';

const useStdcmForm = (): StdcmSimulationInputs => {
  const { getStdcmPathSteps, getSpeedLimitByTag } = useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const currentSimulationInputs = useMemo(() => {
    const origin = pathSteps[0]!;
    return {
      pathSteps,
      departureDate: origin?.arrival,
      consist: {
        tractionEngine: rollingStock,
        speedLimitByTag,
      },
    };
  }, [pathSteps, rollingStock, speedLimitByTag]);

  return currentSimulationInputs;
};

export default useStdcmForm;
