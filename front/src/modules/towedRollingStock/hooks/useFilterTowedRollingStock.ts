import { useEffect, useState } from 'react';

import { osrdEditoastApi, type TowedRollingStock } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

export interface TowedRollingStockFilters {
  id?: number;
  text: string;
}

const initialFilters: TowedRollingStockFilters = {
  text: '',
};

function filterTowedRollingStocks(
  towedRollingStockList: TowedRollingStock[],
  filters: TowedRollingStockFilters
) {
  if (filters === initialFilters) return towedRollingStockList;
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

export default function useFilterTowedRollingStock() {
  const dispatch = useAppDispatch();
  const [filters, setFilters] = useState<TowedRollingStockFilters>({ text: '' });
  const [searchIsLoading, setSearchIsLoading] = useState(true);
  const [filteredTowedRollingStockList, setFilteredTowedRollingStockList] = useState<
    TowedRollingStock[]
  >([]);

  const {
    data: { results: allTowedRollingStocks } = { results: [] },
    isSuccess,
    isError,
    error,
  } = osrdEditoastApi.endpoints.getTowedRollingStock.useQuery({
    pageSize: 50,
  });

  const searchTowedRollingStock = (value: string) => {
    setFilters({ ...filters, id: undefined, text: value });
    setSearchIsLoading(true);
  };

  const searchTowedRollingStockById = (id?: number) => {
    setFilters({ ...filters, id });
    setSearchIsLoading(true);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  useEffect(() => {
    const newFilteredTowedRollingStock = filterTowedRollingStocks(allTowedRollingStocks, filters);
    setFilteredTowedRollingStockList(newFilteredTowedRollingStock);
  }, [isSuccess]);

  useEffect(() => {
    if (isError && error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  }, [isError]);

  useEffect(() => {
    const newFilteredTowedRollingStock = filterTowedRollingStocks(allTowedRollingStocks, filters);
    setTimeout(() => {
      setFilteredTowedRollingStockList(newFilteredTowedRollingStock);
      setSearchIsLoading(false);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allTowedRollingStocks]);

  return {
    allTowedRollingStocks,
    filteredTowedRollingStockList,
    filters,
    searchIsLoading,
    resetFilters,
    searchTowedRollingStock,
    searchTowedRollingStockById,
  };
}
