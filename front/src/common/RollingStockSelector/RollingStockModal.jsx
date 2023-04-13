import React, { useState, useEffect, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import Loader from 'common/Loader';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import './RollingStock.scss';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { isEmpty, some, sortBy } from 'lodash';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import RollingStockEmpty from './RollingStockEmpty';
import RollingStockCard from './RollingStockCard';

function RollingStockModal(props) {
  const { ref2scroll } = props;
  const dispatch = useDispatch();
  const { darkmode } = useSelector((state) => state.main);
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [filteredRollingStockList, setFilteredRollingStockList] = useState([]);
  const [filters, setFilters] = useState({
    text: '',
    elec: false,
    thermal: false,
  });
  const [isFiltering, setIsFiltering] = useState(true);
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

  const searchMateriel = (e) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsFiltering(true);
  };

  const updateSearch = () => {
    setOpenedRollingStockCardId(undefined);

    const filterText = filters.text;
    const filterIsNotEmpty = filterText || filters.elec || filters.thermal;

    const filteredRollingStocks = filterIsNotEmpty
      ? rollingStocks.filter((rollingStock) => {
          // checkbox filters
          if (filters.elec || filters.thermal) {
            const effortCurveModes = Object.values(rollingStock.effort_curves.modes).map(
              // eslint-disable-next-line camelcase
              ({ is_electric }) => is_electric
            );
            const isElectric = effortCurveModes.includes(true);
            const isThermal = effortCurveModes.includes(false);
            if ((filters.elec && !isElectric) || (filters.thermal && !isThermal)) {
              return false;
            }
          }

          // text filter
          if (filterText) {
            const { metadata } = rollingStock;
            const containsFilterText = some(
              [
                rollingStock.name,
                metadata.detail,
                metadata.reference,
                metadata.series,
                metadata.type,
                metadata.grouping,
              ],
              (string) => string && string.toLowerCase().includes(filterText)
            );
            if (!containsFilterText) {
              return false;
            }
          }

          // the rolling stock has passed both the checkbox filter and the text filter
          return true;
        })
      : rollingStocks;

    setTimeout(() => {
      setFilteredRollingStockList(filteredRollingStocks);
      setIsFiltering(false);
    }, 0);
  };

  const toggleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name] });
    setIsFiltering(true);
  };

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
    if (isError) {
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
        <div className="rollingstock-search-list">
          {!isEmpty(filteredRollingStockList) && !isFiltering ? (
            listOfRollingStocks
          ) : (
            <Loader msg={t('rollingstock:waitingLoader')} />
          )}
        </div>
      </div>
    </ModalBodySNCF>
  );
}

RollingStockModal.propTypes = {
  ref2scroll: PropTypes.object.isRequired,
};

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
