import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useEffect } from 'react';

export const useStoreDataForRollingStockSelector = () => {
  const { getRollingStockID, getRollingStockComfort } = useOsrdConfSelectors();
  const rollingStockId = useSelector(getRollingStockID);
  const rollingStockComfort = useSelector(getRollingStockComfort);

  const { data: rollingStock } = osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
    {
      rollingStockId: rollingStockId!,
    },
    {
      skip: !rollingStockId,
    }
  );

  return {
    rollingStockId,
    rollingStockComfort: rollingStockId ? rollingStockComfort : 'STANDARD',
    rollingStock: rollingStockId ? rollingStock : undefined,
  };
};

export default useStoreDataForRollingStockSelector;
