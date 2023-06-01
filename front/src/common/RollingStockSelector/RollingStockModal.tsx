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
  if (!filters.text) {
    return true;
  }
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

function filterRollingStocks(rollingStocks: LightRollingStock[], filters: Filters) {
  return rollingStocks.filter(({ name, metadata, effort_curves: effortCurves }) => {
    const passSearchedStringFilter = rollingStockPassesSearchedStringFilter(
      name,
      metadata,
      filters
    );
    const passEnergeticModesFilter = rollingStockPassesEnergeticModeFilters(
      effortCurves.modes,
      filters
    );
    return passSearchedStringFilter && passEnergeticModesFilter;
  });
}

interface RollingStockModal {
  ref2scroll: MutableRefObject<HTMLDivElement | null>;
}

function RollingStockModal({ ref2scroll }: RollingStockModal) {
  const dispatch = useDispatch();
  const darkmode = useSelector((state: RootState) => state.main.darkmode);
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [filters, setFilters] = useState({
    text: '',
    elec: false,
    thermal: false,
  });
  const [rollingStocks, setRollingStocks] = useState<LightRollingStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockID);
  const { closeModal } = useContext(ModalContext);

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const { apiRollingStocks, isError, error, requestIsLoading } =
    osrdEditoastApi.useGetLightRollingStockQuery(
      {
        pageSize: 1000,
      },
      {
        selectFromResult: (response) => ({
          ...response,
          requestIsLoading: !response.data,
          apiRollingStocks: sortBy(response.data?.results, ['metadata.reference', 'name']) || [],
        }),
      }
    );

  // this useEffect is needed to avoid extra renderings when the filters are updated
  // (apiRollingStocks is re-instantiated at each re-render)
  useEffect(() => {
    if (!requestIsLoading) setRollingStocks(apiRollingStocks);
  }, [requestIsLoading]);

  const filteredRollingStockList = useMemo(
    () => filterRollingStocks(rollingStocks, filters),
    [rollingStocks, filters]
  );

  useEffect(() => {
    if (isLoading && !requestIsLoading) {
      setIsLoading(false);
    }
  }, [filteredRollingStockList]);

  const manageSelectedCardOnFiltersUpdate = () => {
    if (filters.text !== '' || filters.elec !== false || filters.thermal !== false) {
      setOpenRollingStockCardId(undefined);
    } else {
      setOpenRollingStockCardId(rollingStockID);
    }
  };

  const searchMateriel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true);
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
  };

  const toggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true);
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name as 'elec' | 'thermal'] });
  };

  useEffect(() => {
    if (openRollingStockCardId !== undefined) {
      // Because of modal waiting for displaying, have to set a timeout to correctly scroll to ref
      // BUT finally, it's great, it creates a micro-interaction (smooth scroll) !
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    }
  }, [ref2scroll.current]);

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
    manageSelectedCardOnFiltersUpdate();
  }, [filters]);

  const listOfRollingStocks = useMemo(
    () =>
      filteredRollingStockList.length > 0 ? (
        filteredRollingStockList.map((item) => (
          <RollingStockCard
            data={item}
            key={item.id}
            noCardSelected={openRollingStockCardId === undefined}
            isOpen={item.id === openRollingStockCardId}
            setOpenedRollingStockCardId={setOpenRollingStockCardId}
            ref2scroll={openRollingStockCardId === item.id ? ref2scroll : undefined}
          />
        ))
      ) : (
        <RollingStockEmpty />
      ),
    [filteredRollingStockList, openRollingStockCardId, ref2scroll, openRollingStockCardId]
  );

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
