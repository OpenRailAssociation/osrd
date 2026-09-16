import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getStdcmPathSteps } from 'reducers/osrdconf/stdcmConf/selectors';

export const useStdcmLightRollingStock = () => {
  const pathSteps = useSelector(getStdcmPathSteps);
  const rollingStockId = pathSteps[0].consist?.rollingStockID;

  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      rollingStockId ? { rollingStockId } : skipToken
    );

  return rollingStock;
};

export default useStdcmLightRollingStock;
