import React, { useState, useEffect, useContext, useMemo, MutableRefObject } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import { isEmpty, sortBy } from 'lodash';

import { LightRollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { RootState } from 'reducers';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockEmpty from './RollingStockEmpty';
import RollingStockCard from './RollingStockCard';
import './RollingStock.scss';

interface Filters {
  text: string;
  elec: boolean;
  thermal: boolean;
}
function rollingStockPassesSearchedStringFilter(
  name: string,
  metadata: LightRollingStock['metadata'],
  filters: Filters
) {
  function includesSearchedString(str: string) {
    return str && str.toLowerCase().includes(filters.text);
  }
  return [
    name,
    metadata.detail,
    metadata.reference,
    metadata.series,
    metadata.type,
    metadata.grouping,
  ].some(includesSearchedString);
}

export function rollingStockPassesEnergeticModeFilters(
  filterElec: boolean,
  filterThermal: boolean,
  modes: LightRollingStock['effort_curves']['modes']
) {
  if (filterElec || filterThermal) {
    const effortCurveModes = Object.values(modes).map(({ is_electric: isElec }) => isElec);
    const hasAnElectricMode = effortCurveModes.includes(true);
    const hasAThermalMode = effortCurveModes.includes(false);
    if ((filterElec && !hasAnElectricMode) || (filterThermal && !hasAThermalMode)) {
      return false;
    }
  }
  return true;
}

interface RollingStockModal {
  ref2scroll: MutableRefObject<HTMLDivElement>;
}

function RollingStockModal({ ref2scroll }: RollingStockModal) {
  const dispatch = useDispatch();
  const darkmode = useSelector((state: RootState) => state.main.darkmode);
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [filteredRollingStockList, setFilteredRollingStockList] = useState<LightRollingStock[]>([]);
  const [filters, setFilters] = useState({
    text: '',
    elec: false,
    thermal: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState();
  const { closeModal } = useContext(ModalContext);

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const { rollingStocks, isSuccess, isError, error } = osrdEditoastApi.useGetLightRollingStockQuery(
    {
      pageSize: 1000,
    },
    {
      selectFromResult: (response) => ({
        ...response,
        rollingStocks: sortBy(response.data?.results, ['metadata.reference', 'name']) || [],
      }),
    }
  );

  const searchMateriel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsLoading(true);
  };

  const updateSearch = () => {
    setOpenedRollingStockCardId(undefined);
    const newFilteredRollingStock = rollingStocks?.filter(
      ({ name, metadata, effort_curves: effortCurves }) => {
        const passSearchedStringFilter = rollingStockPassesSearchedStringFilter(
          name,
          metadata,
          filters
        );
        const passEnergeticModesFilter = rollingStockPassesEnergeticModeFilters(
          filters.elec,
          filters.thermal,
          effortCurves.modes
        );
        return passSearchedStringFilter && passEnergeticModesFilter;
      }
    );
    if (newFilteredRollingStock) {
      setTimeout(() => {
        setFilteredRollingStockList(newFilteredRollingStock);
        setIsLoading(false);
      }, 0);
    }
  };

  const toggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name as 'elec' | 'thermal'] });
    setIsLoading(true);
  };

  if (rollingStockID !== undefined) {
    // Because of modal waiting for displaying, have to set a timeout to correctly scroll to ref
    // BUT finally, it's great, it creates a micro-interaction (smooth scroll) !
    setTimeout(() => {
      ref2scroll.current?.scrollIntoView({ behavior: 'smooth' });
    }, 1000);
  }

  const listOfRollingStocks = useMemo(
    () =>
      filteredRollingStockList.length > 0 ? (
        filteredRollingStockList.map((item) => (
          <RollingStockCard
            data={item}
            key={item.id}
            noCardSelected={openedRollingStockCardId === undefined}
            isOpen={item.id === openedRollingStockCardId}
            setOpenedRollingStockCardId={setOpenedRollingStockCardId}
            ref2scroll={rollingStockID === item.id ? ref2scroll : undefined}
          />
        ))
      ) : (
        <RollingStockEmpty />
      ),
    [filteredRollingStockList, openedRollingStockCardId, ref2scroll, rollingStockID]
  );

  useEffect(() => {
    if (isError && error && 'status' in error) {
      dispatch(
        setFailure({
          name: t('rollingstock:errorMessages.unableToRetrieveRollingStock'),
          message:
            error.status === 404
              ? t('rollingstock:errorMessages.ressourcesNotFound')
              : t('rollingstock:errorMessages.unableToRetrieveRollingStockMessage'),
        })
      );
    }
  }, [isError]);

  useEffect(() => {
    if (rollingStocks !== undefined) {
      updateSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isSuccess]);

  function displayList() {
    if (isEmpty(filteredRollingStockList)) {
      if (isLoading) {
        return <Loader msg={t('rollingstock:waitingLoader')} />;
      }
      return <div className="rollingstock-empty">{t('rollingstock:noResultFound')}</div>;
    }
    return listOfRollingStocks;
  }

  return (
    <ModalBodySNCF>
      <div className="rollingstock-search p-2">
        <div className="rollingstock-search-filters">
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
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
            <div className="col-md-5 ml-2 mb-3 d-flex align-items-center">
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
        </div>
        <div className="rollingstock-search-list">{displayList()}</div>
      </div>
    </ModalBodySNCF>
  );
}

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
