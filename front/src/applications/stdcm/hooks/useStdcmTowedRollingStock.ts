import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getStdcmPathSteps } from 'reducers/osrdconf/stdcmConf/selectors';

const useStdcmTowedRollingStock = () => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const towedRollingStockId = pathSteps[0].consist?.towedRollingStockID;

  const { currentData: towedRollingStock } =
    osrdEditoastApi.endpoints.getTowedRollingStockByTowedRollingStockId.useQuery(
      towedRollingStockId
        ? {
            towedRollingStockId,
          }
        : skipToken
    );

  return towedRollingStock;
};

export default useStdcmTowedRollingStock;
