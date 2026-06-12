import { createContext, useContext, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { useAsyncMemo } from 'utils/useAsyncMemo';

import useAuthz from './authorization/hooks/useAuthz';

type RollingStockContextValue = {
  rollingStockMap: Map<string, LightRollingStockWithLiveries>;
  rollingStocks: LightRollingStockWithLiveries[] | null;
};

const RollingStockContext = createContext<RollingStockContextValue | null>(null);

export const useRollingStockContext = (): RollingStockContextValue => {
  const context = useContext(RollingStockContext);
  if (!context) {
    throw new Error('useRollingStockContext must be used within a RollingStockContextProvider');
  }
  return context;
};

type RollingStockContextProviderProps = {
  children: React.ReactNode;
};

export const RollingStockContextProvider = ({ children }: RollingStockContextProviderProps) => {
  const dispatch = useAppDispatch();
  const { getUserPrivileges } = useAuthz();
  const { t } = useTranslation();
  const { data, isError } = osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
    pageSize: 1000,
  });

  useEffect(() => {
    if (isError) {
      dispatch(
        setFailure({
          name: t('rollingStock.errorMessages.unableToRetrieveRollingStock'),
          message: t('rollingStock.errorMessages.unableToRetrieveRollingStockMessage'),
        })
      );
    }
  }, [isError]);

  const rollingStocks = useAsyncMemo(async () => {
    const allRollingStocks = data?.results ?? [];
    // TODO: remove the check of user permissions when list of rolling stock API will take care of
    // the user's permissions. For now we need to do the filter on the frontend side
    const { rolling_stock: privilegesById } = await getUserPrivileges({
      rolling_stock: allRollingStocks.map((rs) => rs.id),
    });
    return allRollingStocks.filter((rs) => privilegesById[rs.id].has('can_read'));
  }, [data?.results, getUserPrivileges]);

  const value = useMemo(() => {
    const list = rollingStocks.type === 'ready' ? rollingStocks.data : [];
    const map = new Map<string, LightRollingStockWithLiveries>(list.map((rs) => [rs.name, rs]));
    return { rollingStocks: list, rollingStockMap: map };
  }, [rollingStocks]);

  return <RollingStockContext.Provider value={value}>{children}</RollingStockContext.Provider>;
};
