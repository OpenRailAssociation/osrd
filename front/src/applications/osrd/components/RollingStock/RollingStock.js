import React, { useState, useEffect } from 'react';
import Loader from 'common/Loader';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import RollingStockCard from 'applications/osrd/components/RollingStock/RollingStockCard';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import 'applications/osrd/components/RollingStock/RollingStock.scss';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import rollingStockDetailDB from './consts/rollingstockDetailDB.json';

const ROLLING_STOCK_URL = '/light_rolling_stock/';

// To remove when details will be inside backend DB
const mergeDetailsWithDB = (data, dataDetails) =>
  data.map((rollingstock) => ({
    ...rollingstock,
    ...dataDetails[rollingstock.name],
  }));

export default function RollingStock() {
  const dispatch = useDispatch();
  const { darkmode } = useSelector((state) => state.main);
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

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const searchMateriel = (e) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsFiltering(true);
  };

  const updateSearch = () => {
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
        const mergedData = mergeDetailsWithDB(data.results, rollingStockDetailDB);
        setRollingStock(mergedData);
        setFilteredRollingStockList(mergedData);
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

  useEffect(() => {
    getAllRollingStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rollingStock !== undefined) {
      updateSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="rollingstock-search p-2">
      <div className="rollingstock-search-filters">
        <h2 className="d-flex">
          {t('translation:common.filter')}
          <small className="ml-auto">
            {filteredRollingStockList !== undefined && filteredRollingStockList.length > 0
              ? `${filteredRollingStockList.length} ${t('rollingstock:resultsFound')}`
              : t('rollingstock:noResultFound')}
          </small>
        </h2>
        <div className="row">
          <div className="col-md-6 mb-3">
            <InputSNCF
              id="searchfilter"
              type="text"
              onChange={searchMateriel}
              placeholder={t('translation:common.search')}
              noMargin
              clearButton
              sm
            />
          </div>
          <div className="col-md-6 mb-3 d-flex align-items-end">
            <div className="mr-5">
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
        </div>
      </div>
      <div className="rollingstock-search-list">
        {filteredRollingStockList !== undefined && !isFiltering ? (
          filteredRollingStockList.map((item) => (
            <RollingStockCard
              data={item}
              key={item.id}
              openedRollingStockCardId={openedRollingStockCardId}
              setOpenedRollingStockCardId={setOpenedRollingStockCardId}
            />
          ))
        ) : (
          <Loader msg={t('rollingstock:waitingLoader')} />
        )}
      </div>
    </div>
  );
}
