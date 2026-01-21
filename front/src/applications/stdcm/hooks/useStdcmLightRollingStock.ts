import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getStdcmRollingStockID } from 'reducers/osrdconf/stdcmConf/selectors';

export const useStdcmLightRollingStock = () => {
  const rollingStockId = useSelector(getStdcmRollingStockID);

  const { data: rollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      rollingStockId ? { rollingStockId } : skipToken
    );

  return rollingStock;
};

export default useStdcmLightRollingStock;
