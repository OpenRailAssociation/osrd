import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getTowedRollingStockID } from 'reducers/osrdconf/stdcmConf/selectors';

const useStdcmTowedRollingStock = () => {
  const towedRollingStockId = useSelector(getTowedRollingStockID);

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
