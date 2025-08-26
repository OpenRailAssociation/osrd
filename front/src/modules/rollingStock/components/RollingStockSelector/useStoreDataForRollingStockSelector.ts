import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getRollingStockComfort } from 'reducers/osrdconf/operationalStudiesConf/selectors';

export const useStoreDataForRollingStockSelector = ({
  rollingStockId,
}: {
  rollingStockId: number | undefined;
}) => {
  const rollingStockComfort = useSelector(getRollingStockComfort);

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
    rollingStockComfort: rollingStockId ? rollingStockComfort : 'STANDARD',
    rollingStock: rollingStockId ? rollingStock : undefined,
  };
};

export default useStoreDataForRollingStockSelector;
