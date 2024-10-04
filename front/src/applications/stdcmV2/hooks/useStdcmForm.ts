import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useOsrdConfSelectors } from 'common/osrdContext';
import type { StdcmSimulationInputs } from '../types';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import useStoreDataForRollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';

const useStdcmForm = () => {
  const { getStdcmPathSteps, getSpeedLimitByTag } = useOsrdConfSelectors() as StdcmConfSelectors;
  const pathSteps = useSelector(getStdcmPathSteps);
  const speedLimitByTag = useSelector(getSpeedLimitByTag);
  const { rollingStock } = useStoreDataForRollingStockSelector();

  const currentSimulationInputs: StdcmSimulationInputs = useMemo(() => {
    const origin = pathSteps[0]!;
    const result = {
      pathSteps,
      departureDate: origin?.arrival,
      consist: {
        rollingStock,
        speedLimitByTag,
      },
    };
    console.log(result);
    return result;
  }, [pathSteps, rollingStock, speedLimitByTag]);

  return currentSimulationInputs;
};

export default useStdcmForm;
