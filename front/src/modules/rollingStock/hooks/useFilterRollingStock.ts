import { useState, useEffect, useMemo } from 'react';

import type { CategoryOption } from 'applications/rollingStockEditor/types';
import { STDCM_ROLLING_STOCKS } from 'assets/rollingStock/freightRollingStocks';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  LightRollingStock,
  LightRollingStockWithLiveries,
  TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

/**
 * - id: the rolling stock id
 * - text: a string to search in the rolling stock name, detail, reference, series, type, grouping
 * - elec: true if the rolling stock has an electric mode
 * - thermal: true if the rolling stock has a thermal mode
 * - locked: true if the rolling stock is native in the database, can't be updated/deleted
 * - notLocked: true if the rolling stock is created by the user, can be updated/deleted
 * - category: the category the rolling stocks should have as primary or other categories, none means no restriction
 */
export type RollingStockFilters = {
  id?: number;
  text: string;
  elec: boolean;
  thermal: boolean;
  locked: boolean;
  notLocked: boolean;
  category?: TrainMainCategory;
};

export type RollingStockFilterKeys = keyof Omit<RollingStockFilters, 'text'>;

const initialFilters = {
  text: '',
  elec: false,
  thermal: false,
  locked: false,
  notLocked: false,
  category: undefined,
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
    metadata?.subseries,
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

function rollingStockPassesCategoryFilter(
  categories: TrainMainCategory[],
  filters: RollingStockFilters
) {
  if (!filters.category) {
    return true;
  }
  return categories.includes(filters.category);
}

function filterRollingStocks(
  rollingStockList: LightRollingStockWithLiveries[],
  filters: RollingStockFilters
) {
  if (filters === initialFilters) return rollingStockList;
  return rollingStockList.filter((rollingStock) => {
    const { id, name, metadata, effort_curves: effortCurves, locked } = rollingStock;
    const categories = rollingStock.other_categories.concat(rollingStock.primary_category);

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
    const passCategoryFilter = rollingStockPassesCategoryFilter(categories, filters);
    return (
      passSearchedStringFilter &&
      passEnergeticModesFilter &&
      passLockedFilter &&
      passNotlockedFilter &&
      passCategoryFilter
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

function computeCategoryFilter(filters: RollingStockFilters, category?: CategoryOption) {
  return { ...filters, category: category?.id };
}

const useFilterRollingStock = ({
  isStdcm = false,
  isDebugMode = false,
}: {
  isStdcm?: boolean;
  isDebugMode?: boolean;
} = {}) => {
  const dispatch = useAppDispatch();

  const [filters, setFilters] = useState<RollingStockFilters>(initialFilters);

  const {
    data: { results: allRollingStocks } = { results: [] },
    isFetching,
    isError,
    error,
  } = osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
    pageSize: 1000,
  });

  const usefulRollingStocks = useMemo(
    () =>
      isStdcm && !isDebugMode
        ? allRollingStocks.filter((rs) => STDCM_ROLLING_STOCKS.includes(rs.name))
        : allRollingStocks,
    [isStdcm, isDebugMode, allRollingStocks]
  );

  const [searchIsLoading, setSearchIsLoading] = useState(true);

  const [filteredRollingStockList, setFilteredRollingStockList] = useState<
    LightRollingStockWithLiveries[]
  >([]);

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

  const selectCategoryFilter = (category?: CategoryOption) => {
    setFilters(computeCategoryFilter(filters, category));
    setSearchIsLoading(true);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  useEffect(() => {
    if (isError && error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  }, [isError]);

  useEffect(() => {
    const newFilteredRollingStock = filterRollingStocks(usefulRollingStocks, filters);
    if (isFetching) return;
    setTimeout(() => {
      setFilteredRollingStockList(newFilteredRollingStock);
      setSearchIsLoading(false);
    }, 0);
  }, [filters, usefulRollingStocks, isFetching]);

  return {
    filteredRollingStockList,
    filters,
    searchIsLoading,
    resetFilters,
    searchRollingStock,
    searchRollingStockById,
    toggleFilter,
    selectCategoryFilter,
  };
};

export default useFilterRollingStock;
