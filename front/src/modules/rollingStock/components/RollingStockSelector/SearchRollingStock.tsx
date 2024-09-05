import { Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { BiLockAlt, BiLockOpenAlt } from 'react-icons/bi';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import type { RollingStockFilters } from 'modules/rollingStock/hooks/useFilterRollingStock';

type SearchRollingStockProps = {
  filteredRollingStockList: LightRollingStockWithLiveries[];
  searchRollingStock: (value: string) => void;
  toggleFilter: (filter: 'elec' | 'thermal' | 'locked' | 'notLocked') => void;
  filters: RollingStockFilters;
  hasWhiteBackground?: boolean;
};

const SearchRollingStock = ({
  filteredRollingStockList,
  filters,
  searchRollingStock,
  toggleFilter,
  hasWhiteBackground,
}: SearchRollingStockProps) => {
  const { t } = useTranslation('rollingstock');

  return (
    <div className="row no-gutters">
      <div className="col-md-4 mb-3">
        <InputSNCF
          id="searchfilter"
          type="text"
          value={filters.text}
          onChange={(e) => searchRollingStock(e.target.value)}
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
            onChange={() => toggleFilter('elec')}
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
            onChange={() => toggleFilter('thermal')}
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
            onChange={() => toggleFilter('locked')}
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
            onChange={() => toggleFilter('notLocked')}
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
        <small data-testid="search-results-text">
          {filteredRollingStockList.length > 0
            ? `${filteredRollingStockList.length} ${t('resultsFound')}`
            : t('noResultFound')}
        </small>
      </div>
    </div>
  );
};

export default SearchRollingStock;
