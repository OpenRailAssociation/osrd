import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiLockAlt, BiLockOpenAlt } from 'react-icons/bi';
import { BsLightningFill } from 'react-icons/bs';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { MdLocalGasStation } from 'react-icons/md';

import type { LightRollingStock, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { Search } from '@osrd-project/ui-icons';

// text: a string to search in the rolling stock name, detail, reference, series, type, grouping
// elec: true if the rolling stock has an electric mode
// thermal: true if the rolling stock has a thermal mode
// locked: true if the rolling stock is native in the database, can't be updated/deleted
// notLocked: true if the rolling stock is created by the user, can be updated/deleted
interface Filters {
  text: string;
  elec: boolean;
  thermal: boolean;
  locked: boolean;
  notLocked: boolean;
}

export function rollingStockPassesEnergeticModeFilters(
  modes: LightRollingStock['effort_curves']['modes'],
  { elec, thermal }: Filters
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
  filters: Filters
) {
  if (!filters.text) {
    return true;
  }
  function includesSearchedString(str: string) {
    return str && str.toLowerCase().includes(filters.text);
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

function rollingStockPassesLockedFilter(locked: boolean, filters: Filters) {
  if (filters.locked && !locked) {
    return false;
  }
  return true;
}

function rollingStockPassesNotlockedFilter(locked: boolean, filters: Filters) {
  if (filters.notLocked && locked) {
    return false;
  }
  return true;
}

function filterRollingStocks(rollingStockList: LightRollingStockWithLiveries[], filters: Filters) {
  return rollingStockList?.filter(({ name, metadata, effort_curves: effortCurves, locked }) => {
    const passSearchedStringFilter = rollingStockPassesSearchedStringFilter(
      name,
      metadata,
      filters
    );
    const passEnergeticModesFilter = rollingStockPassesEnergeticModeFilters(
      effortCurves?.modes,
      filters
    );
    const passLockedFilter = rollingStockPassesLockedFilter(locked as boolean, filters);
    const passNotlockedFilter = rollingStockPassesNotlockedFilter(locked as boolean, filters);
    return (
      passSearchedStringFilter &&
      passEnergeticModesFilter &&
      passLockedFilter &&
      passNotlockedFilter
    );
  });
}

type SearchRollingStockProps = {
  rollingStocks: LightRollingStockWithLiveries[];
  setFilteredRollingStockList: (rollingStocks: LightRollingStockWithLiveries[]) => void;
  filteredRollingStockList: LightRollingStockWithLiveries[];
  setIsLoading?: (isLoading: boolean) => void;
  isSuccess?: boolean;
  mustResetFilters?: boolean;
  setMustResetFilters?: (mustResetFilters: boolean) => void;
  hasWhiteBackground?: boolean;
};

const SearchRollingStock = ({
  rollingStocks,
  setFilteredRollingStockList,
  filteredRollingStockList,
  setIsLoading,
  isSuccess,
  mustResetFilters,
  setMustResetFilters,
  hasWhiteBackground,
}: SearchRollingStockProps) => {
  const { t } = useTranslation('rollingstock');

  const [filters, setFilters] = useState<Filters>({
    text: '',
    elec: false,
    thermal: false,
    locked: false,
    notLocked: false,
  });

  const searchMateriel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    if (setIsLoading) setIsLoading(true);
  };
  // TODO: investigate if the main condition does not have bad side effects
  const toggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'notLocked' && filters.locked) {
      setFilters({ ...filters, notLocked: true, locked: false });
    } else if (e.target.name === 'locked' && filters.notLocked) {
      setFilters({ ...filters, locked: true, notLocked: false });
    } else {
      setFilters({
        ...filters,
        [e.target.name]: !filters[e.target.name as 'elec' | 'thermal' | 'locked' | 'notLocked'],
      });
    }
    if (setIsLoading) setIsLoading(true);
  };

  const updateSearch = () => {
    const newFilteredRollingStock = filterRollingStocks(rollingStocks, filters);
    setTimeout(() => {
      setFilteredRollingStockList(newFilteredRollingStock);
      if (setIsLoading) setIsLoading(false);
    }, 0);
  };

  function handleRollingStockLoaded() {
    const newFilteredRollingStock = filterRollingStocks(rollingStocks, filters);
    setFilteredRollingStockList(newFilteredRollingStock);
  }

  const resetFilters = () => {
    setFilters({
      text: '',
      elec: false,
      thermal: false,
      locked: false,
      notLocked: false,
    });
  };

  useEffect(() => {
    handleRollingStockLoaded();
  }, [isSuccess]);

  useEffect(() => {
    updateSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, rollingStocks]);

  useEffect(() => {
    if (mustResetFilters && setMustResetFilters) {
      resetFilters();
      setMustResetFilters(false);
    }
  }, [mustResetFilters]);

  return (
    <div className="row no-gutters">
      <div className="col-md-4 mb-3">
        <InputSNCF
          id="searchfilter"
          type="text"
          onChange={searchMateriel}
          placeholder={t('translation:common.search')}
          noMargin
          unit={<Search />}
          whiteBG={hasWhiteBackground}
          sm
        />
      </div>
      <div className="col-md-5 ml-2 mb-3 d-flex align-items-center flex-wrap">
        <div className="mr-3">
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="elec"
            id="elec"
            label={
              <span className="text-nowrap">
                <span className="text-primary mr-1">
                  <BsLightningFill />
                </span>
                {t('electric')}
              </span>
            }
            type="checkbox"
            checked={filters.elec}
          />
        </div>
        <div className="mr-3">
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="thermal"
            id="thermal"
            label={
              <span className="text-nowrap">
                <span className="text-pink mr-1">
                  <MdLocalGasStation />
                </span>
                {t('thermal')}
              </span>
            }
            type="checkbox"
            checked={filters.thermal}
          />
        </div>
        <div className="mr-3">
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="locked"
            id="locked"
            label={
              <span className="text-nowrap">
                <span className="text-black mr-1">
                  <BiLockAlt />
                </span>
                {t('locked')}
              </span>
            }
            type="checkbox"
            checked={filters.locked}
          />
        </div>
        <div>
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="notLocked"
            id="notLocked"
            label={
              <span className="text-nowrap">
                <span className="text-black mr-1">
                  <BiLockOpenAlt />
                </span>
                {t('notLocked')}
              </span>
            }
            type="checkbox"
            checked={filters.notLocked}
          />
        </div>
      </div>
      <div className="col-md-2 mt-1 ml-auto">
        <small>
          {filteredRollingStockList.length > 0
            ? `${filteredRollingStockList.length} ${t('resultsFound')}`
            : t('noResultFound')}
        </small>
      </div>
    </div>
  );
};

export default SearchRollingStock;
