import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getTowedRollingStockID } from 'reducers/osrdconf/stdcmConf/selectors';

const useStdcmTowedRollingStock = () => {
  const towedRollingStockId = useSelector(getTowedRollingStockID);

  const { currentData: towedRollingStock } =
    osrdEditoastApi.endpoints.getTowedRollingStockByTowedRollingStockId.useQuery(
      {
        towedRollingStockId: towedRollingStockId!,
      },
      {
        skip: !towedRollingStockId,
      }
    );

  return towedRollingStock;
};

export default useStdcmTowedRollingStock;
