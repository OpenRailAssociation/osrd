import { skipToken } from '@reduxjs/toolkit/query';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export const useStoreDataForRollingStockSelector = ({
  rollingStockId,
}: {
  rollingStockId: number | undefined;
}) => {
  const { currentData: rollingStock } =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
      rollingStockId
        ? {
            rollingStockId,
          }
        : skipToken
    );

  return {
    rollingStockId,
    rollingStock: rollingStockId ? rollingStock : undefined,
  };
};

export default useStoreDataForRollingStockSelector;
