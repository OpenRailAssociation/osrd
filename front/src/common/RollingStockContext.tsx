import { createContext, useContext, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

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

  const value = useMemo(() => {
    const rollingStocks = data?.results ?? [];
    const rollingStockMap = new Map<string, LightRollingStockWithLiveries>(
      rollingStocks.map((rs) => [rs.name, rs])
    );
    return { rollingStockMap, rollingStocks };
  }, [data?.results]);

  return <RollingStockContext.Provider value={value}>{children}</RollingStockContext.Provider>;
};
