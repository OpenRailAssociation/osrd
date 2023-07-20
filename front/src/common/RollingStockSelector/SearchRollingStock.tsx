import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';

interface Filters {
  text: string;
  elec: boolean;
  thermal: boolean;
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
  filterList: Filters
) {
  if (!filterList.text) {
    return true;
  }
  function includesSearchedString(str: string) {
    return str && str.toLowerCase().includes(filterList.text);
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

function filterRollingStocks(rollingStockList: LightRollingStock[], filterList: Filters) {
  return rollingStockList?.filter(({ name, metadata, effort_curves: effortCurves }) => {
    const passSearchedStringFilter = rollingStockPassesSearchedStringFilter(
      name,
      metadata,
      filterList
    );
    const passEnergeticModesFilter = rollingStockPassesEnergeticModeFilters(
      effortCurves?.modes,
      filterList
    );
    return passSearchedStringFilter && passEnergeticModesFilter;
  });
}

type SearchRollingStockProps = {
  rollingStocks: LightRollingStock[];
  rollingStockID?: number;
  setOpenedRollingStockCardId: (rollingStockID: number | undefined) => void;
  setFilteredRollingStockList: (rollingStocks: LightRollingStock[]) => void;
  filteredRollingStockList: LightRollingStock[];
  setIsLoading?: (isLoading: boolean) => void;
  isSuccess?: boolean;
};

const SearchRollingStock = ({
  rollingStocks,
  rollingStockID,
  setOpenedRollingStockCardId,
  setFilteredRollingStockList,
  filteredRollingStockList,
  setIsLoading,
  isSuccess,
}: SearchRollingStockProps) => {
  const { t } = useTranslation('rollingStockEditor');

  const [filters, setFilters] = useState({
    text: '',
    elec: false,
    thermal: false,
  });

  const searchMateriel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    if (setIsLoading) setIsLoading(true);
  };
  const toggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name as 'elec' | 'thermal'] });
    if (setIsLoading) setIsLoading(true);
  };

  const updateSearch = () => {
    if (filters.text !== '' || filters.elec !== false || filters.thermal !== false) {
      setOpenedRollingStockCardId(undefined);
    } else {
      setOpenedRollingStockCardId(rollingStockID);
    }
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

  useEffect(() => {
    handleRollingStockLoaded();
  }, [isSuccess]);

  useEffect(() => {
    if (rollingStocks && rollingStocks.length !== 0) {
      updateSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="row no-gutters">
      <div className="col-md-4 mb-3">
        <InputSNCF
          id="searchfilter"
          type="text"
          onChange={searchMateriel}
          placeholder={t('translation:common.search')}
          noMargin
          unit={<i className="icons-search" />}
          sm
        />
      </div>
      <div className="col-md-5 ml-2 mb-3 d-flex align-items-center flex-wrap">
        <div className="mr-4">
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="elec"
            id="elec"
            label={
              <span className="text-nowrap">
                <span className="text-primary mr-1">
                  <BsLightningFill />
                </span>
                {t('rollingstock:electric')}
              </span>
            }
            type="checkbox"
            checked={filters.elec}
          />
        </div>
        <div>
          <CheckboxRadioSNCF
            onChange={toggleFilter}
            name="thermal"
            id="thermal"
            label={
              <span className="text-nowrap">
                <span className="text-pink mr-1">
                  <MdLocalGasStation />
                </span>
                {t('rollingstock:thermal')}
              </span>
            }
            type="checkbox"
            checked={filters.thermal}
          />
        </div>
      </div>
      <div className="col-md-2 mt-1 ml-auto">
        <small className="">
          {filteredRollingStockList.length > 0
            ? `${filteredRollingStockList.length} ${t('rollingstock:resultsFound')}`
            : t('rollingstock:noResultFound')}
        </small>
      </div>
    </div>
  );
};

export default SearchRollingStock;
