import { useEffect, useMemo, useState } from 'react';

import { isEqual } from 'lodash';

import { ALLOWED_TOWED_ROLLING_STOCKS } from 'assets/rollingStock/freightRollingStocks';
import { osrdEditoastApi, type TowedRollingStock } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

export type TowedRollingStockFilters = {
  id?: number;
  text: string;
};

const initialFilters: TowedRollingStockFilters = {
  text: '',
};

function filterTowedRollingStocks(
  towedRollingStockList: TowedRollingStock[],
  filters: TowedRollingStockFilters
) {
  if (isEqual(filters, initialFilters)) return towedRollingStockList;
  return towedRollingStockList.filter(({ id, name }) => {
    if (filters.id !== undefined) {
      return id === filters.id;
    }
    if (!filters.text) {
      return true;
    }
    return name.trim().toLowerCase().includes(filters.text.trim().toLowerCase());
  });
}

const useFilterTowedRollingStock = ({ isDebugMode }: { isDebugMode: boolean }) => {
  const dispatch = useAppDispatch();
  const [filters, setFilters] = useState<TowedRollingStockFilters>({ text: '' });
  const [filteredTowedRollingStockList, setFilteredTowedRollingStockList] = useState<
    TowedRollingStock[]
  >([]);

  const {
    data: { results: fetchedTowedRollingStocks } = { results: [] },
    isSuccess,
    isError,
    error,
  } = osrdEditoastApi.endpoints.getTowedRollingStock.useQuery({
    pageSize: 50,
  });

  const allTowedRollingStocks = useMemo(() => {
    if (!isDebugMode) {
      return fetchedTowedRollingStocks.filter((stock) =>
        ALLOWED_TOWED_ROLLING_STOCKS.includes(stock.name)
      );
    }
    return fetchedTowedRollingStocks;
  }, [fetchedTowedRollingStocks, isDebugMode]);

  const searchTowedRollingStock = (value: string) => {
    setFilters({ id: undefined, text: value });
  };

  const searchTowedRollingStockById = (id?: number) => {
    setFilters({ ...filters, id });
  };

  useEffect(() => {
    if (isError && error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  }, [isError]);

  useEffect(() => {
    const newFilteredTowedRollingStocks = filterTowedRollingStocks(allTowedRollingStocks, filters);
    setTimeout(() => {
      setFilteredTowedRollingStockList(newFilteredTowedRollingStocks);
    }, 0);
  }, [isSuccess, filters, allTowedRollingStocks]);

  return {
    allTowedRollingStocks,
    filteredTowedRollingStockList,
    filters,
    searchTowedRollingStock,
    searchTowedRollingStockById,
  };
};

export default useFilterTowedRollingStock;
