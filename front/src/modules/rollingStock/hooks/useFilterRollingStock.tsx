import { useState, useEffect } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { LightRollingStock, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { notifyFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

/**
 * - id: the rolling stock id
 * - text: a string to search in the rolling stock name, detail, reference, series, type, grouping
 * - elec: true if the rolling stock has an electric mode
 * - thermal: true if the rolling stock has a thermal mode
 * - locked: true if the rolling stock is native in the database, can't be updated/deleted
 * - notLocked: true if the rolling stock is created by the user, can be updated/deleted
 */
export interface RollingStockFilters {
  id?: number;
  text: string;
  elec: boolean;
  thermal: boolean;
  locked: boolean;
  notLocked: boolean;
}

export type RollingStockFilterKeys = keyof Omit<RollingStockFilters, 'text'>;

const initialFilters = {
  text: '',
  elec: false,
  thermal: false,
  locked: false,
  notLocked: false,
};

export function rollingStockPassesEnergeticModeFilters(
  modes: LightRollingStock['effort_curves']['modes'],
  { elec, thermal }: RollingStockFilters
) {
  if (elec || thermal) {
    const effortCurveModes = Object.values(modes).map(({ is_electric: isElec }) => isElec);
    const hasAnElectricMode = effortCurveModes.includes(true);
    const hasAThermalMode = effortCurveModes.includes(false);
    if ((elec && !hasAnElectricMode) || (thermal && !hasAThermalMode)) {
      return false;
    }
  }
  return true;
}

function rollingStockPassesSearchedStringFilter(
  name: string,
  metadata: LightRollingStock['metadata'],
  filters: RollingStockFilters
) {
  if (!filters.text) {
    return true;
  }
  function includesSearchedString(str: string | undefined) {
    return str?.trim().toLowerCase().includes(filters.text.trim().toLowerCase());
  }
  return [
    name,
    metadata?.detail,
    metadata?.reference,
    metadata?.series,
    metadata?.type,
    metadata?.grouping,
  ].some(includesSearchedString);
}

function rollingStockPassesLockedFilter(isLocked: boolean, filters: RollingStockFilters) {
  if (filters.locked && !isLocked) {
    return false;
  }
  return true;
}

function rollingStockPassesNotlockedFilter(isLocked: boolean, filters: RollingStockFilters) {
  if (filters.notLocked && isLocked) {
    return false;
  }
  return true;
}

function filterRollingStocks(
  rollingStockList: LightRollingStockWithLiveries[],
  filters: RollingStockFilters
) {
  if (filters === initialFilters) return rollingStockList;
  return rollingStockList.filter((rollingStock) => {
    const { id, name, metadata, effort_curves: effortCurves, locked } = rollingStock;

    if (filters.id !== undefined) {
      return id === filters.id;
    }

    const passSearchedStringFilter = rollingStockPassesSearchedStringFilter(
      name,
      metadata,
      filters
    );
    const passEnergeticModesFilter = rollingStockPassesEnergeticModeFilters(
      effortCurves.modes,
      filters
    );
    const passLockedFilter = rollingStockPassesLockedFilter(locked, filters);
    const passNotlockedFilter = rollingStockPassesNotlockedFilter(locked, filters);
    return (
      passSearchedStringFilter &&
      passEnergeticModesFilter &&
      passLockedFilter &&
      passNotlockedFilter
    );
  });
}

export function computeFilter(filter: RollingStockFilterKeys, filters: RollingStockFilters) {
  // TODO: investigate if the main condition does not have bad side effects
  if (filter === 'notLocked' && filters.locked) {
    return { ...filters, notLocked: true, locked: false };
  }
  if (filter === 'locked' && filters.notLocked) {
    return { ...filters, locked: true, notLocked: false };
  }
  return {
    ...filters,
    [filter]: !filters[filter],
  };
}

export default function useFilterRollingStock() {
  const dispatch = useAppDispatch();

  const [filters, setFilters] = useState<RollingStockFilters>(initialFilters);

  const {
    data: { results: allRollingStocks } = { results: [] },
    isSuccess,
    isError,
    error,
  } = osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
    pageSize: 1000,
  });

  const [searchIsLoading, setSearchIsLoading] = useState(true);

  const [filteredRollingStockList, setFilteredRollingStockList] =
    useState<LightRollingStockWithLiveries[]>(allRollingStocks);

  const searchRollingStock = (value: string) => {
    setFilters({ ...filters, id: undefined, text: value });
    setSearchIsLoading(true);
  };

  const searchRollingStockById = (id?: number) => {
    setFilters({ ...filters, id });
    setSearchIsLoading(true);
  };

  const toggleFilter = (filter: RollingStockFilterKeys) => {
    setFilters(computeFilter(filter, filters));
    setSearchIsLoading(true);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  useEffect(() => {
    if (isError && error) {
      dispatch(notifyFailure(castErrorToFailure(error)));
    }
  }, [isError]);

  useEffect(() => {
    const newFilteredRollingStock = filterRollingStocks(allRollingStocks, filters);
    setFilteredRollingStockList(newFilteredRollingStock);
  }, [isSuccess]);

  useEffect(() => {
    const newFilteredRollingStock = filterRollingStocks(allRollingStocks, filters);
    setTimeout(() => {
      setFilteredRollingStockList(newFilteredRollingStock);
      setSearchIsLoading(false);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allRollingStocks]);

  return {
    filteredRollingStockList,
    filters,
    searchIsLoading,
    resetFilters,
    searchRollingStock,
    searchRollingStockById,
    toggleFilter,
  };
}
