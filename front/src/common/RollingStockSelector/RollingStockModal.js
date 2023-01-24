import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import './RollingStock.scss';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockEmpty from './RollingStockEmpty';
import RollingStockCard from './RollingStockCard';

const ROLLING_STOCK_URL = '/light_rolling_stock/';

function RollingStockModal(props) {
  const { ref2scroll } = props;
  const dispatch = useDispatch();
  const { darkmode } = useSelector((state) => state.main);
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [rollingStock, setRollingStock] = useState();
  const [filteredRollingStockList, setFilteredRollingStockList] = useState();
  const [filters, setFilters] = useState({
    text: '',
    elec: false,
    thermal: false,
  });
  const [isFiltering, setIsFiltering] = useState(false);
  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState();
  const { closeModal } = useContext(ModalContext);

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const searchMateriel = (e) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsFiltering(true);
  };

  const updateSearch = () => {
    setOpenedRollingStockCardId(undefined);
    // Text filter
    let filteredRollingStockListNew = rollingStock.filter(
      (el) =>
        el.name.toLowerCase().includes(filters.text) ||
        (el.detail && el.detail.toLowerCase().includes(filters.text)) ||
        (el.reference && el.reference.toLowerCase().includes(filters.text)) ||
        (el.series && el.series.toLowerCase().includes(filters.text)) ||
        (el.type && el.type.toLowerCase().includes(filters.text)) ||
        (el.grouping && el.grouping.toLowerCase().includes(filters.text))
    );

    // checkbox filters
    if (filters.elec) {
      filteredRollingStockListNew = filteredRollingStockListNew.filter((el) =>
        Object.keys(el.effort_curves.modes).find(
          (mode) => el.effort_curves.modes[mode].is_electric === true
        )
      );
    }
    if (filters.thermal) {
      filteredRollingStockListNew = filteredRollingStockListNew.filter((el) =>
        Object.keys(el.effort_curves.modes).find(
          (mode) => el.effort_curves.modes[mode].is_electric === false
        )
      );
    }

    // ASC sort by default
    filteredRollingStockListNew = filteredRollingStockListNew.sort((a, b) => {
      if (a.reference && b.reference && a.reference !== b.reference) {
        return a.name.localeCompare(b.name) && a.reference.localeCompare(b.reference);
      }
      return a.name.localeCompare(b.name);
    });

    setTimeout(() => {
      setFilteredRollingStockList(filteredRollingStockListNew);
      setIsFiltering(false);
    }, 0);
  };

  const toggleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name] });
    setIsFiltering(true);
  };

  const getAllRollingStock = async () => {
    if (rollingStock === undefined) {
      try {
        const data = await get(ROLLING_STOCK_URL, { page_size: 1000 });
        setRollingStock(data.results);
      } catch (e) {
        dispatch(
          setFailure({
            name: t('osrdconf:errorMessages.unableToRetrieveRollingStock'),
            message: e.message,
          })
        );
        console.log(e);
      }
    }
  };

  const listOfRollingStock = () =>
    filteredRollingStockList.length > 0 ? (
      filteredRollingStockList.map((item) => (
        <RollingStockCard
          data={item}
          key={nextId()}
          openedRollingStockCardId={openedRollingStockCardId}
          setOpenedRollingStockCardId={setOpenedRollingStockCardId}
          ref2scroll={rollingStockID === item.id ? ref2scroll : undefined}
        />
      ))
    ) : (
      <RollingStockEmpty />
    );

  useEffect(() => {
    getAllRollingStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rollingStock !== undefined) {
      updateSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, rollingStock]);

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
                {filteredRollingStockList !== undefined && filteredRollingStockList.length > 0
                  ? `${filteredRollingStockList.length} ${t('rollingstock:resultsFound')}`
                  : t('rollingstock:noResultFound')}
              </small>
            </div>
          </div>
        </div>
        <div className="rollingstock-search-list">
          {filteredRollingStockList !== undefined && !isFiltering ? (
            listOfRollingStock()
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
