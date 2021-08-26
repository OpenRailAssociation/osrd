import React, { useState, useEffect } from 'react';
import Loader from 'common/Loader';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main.ts';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import RollingStockCard from 'applications/osrd/components/RollingStock/RollingStockCard';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import 'applications/osrd/components/RollingStock/RollingStock.scss';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export default function RollingStock() {
  const dispatch = useDispatch();
  const { darkmode } = useSelector((state) => state.main);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [rollingStock, setRollingStock] = useState(undefined);
  const [resultContent, setResultContent] = useState(undefined);
  const [filters, setFilters] = useState({
    text: '',
    elec: true,
    diesel: true,
    sort: true, // true for ASC, false for DESC
  });
  const [isFiltering, setIsFiltering] = useState(false);

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const searchMateriel = (e) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsFiltering(true);
  };

  const updateSearch = () => {
    // Text filter
    let resultContentNew = rollingStock.filter(
      (el) => el.name.toLowerCase().includes(filters.text),
    );

    // checkbox filters
    if (!filters.elec) {
      resultContentNew = resultContentNew.filter((el) => el.modetraction !== 'E');
    }
    if (!filters.diesel) {
      resultContentNew = resultContentNew.filter((el) => el.modetraction !== 'D');
    }

    resultContentNew = (filters.sort)
      ? resultContentNew.sort((a, b) => a.name.localeCompare(b.name))
      : resultContentNew.sort((a, b) => b.name.localeCompare(a.name));

    setTimeout(() => {
      setResultContent(resultContentNew);
      setIsFiltering(false);
    }, 0);
  };

  const displayMateriel = (result) => (
    <RollingStockCard
      data={result}
      key={result.id}
    />
  );

  const toggleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name] });
    setIsFiltering(true);
  };

  const optionsSort = [
    { id: 'asc', name: t('translation:common.asc') },
    { id: 'dsc', name: t('translation:common.dsc') },
  ];

  const getAllMateriel = async () => {
    if (rollingStock === undefined) {
      try {
        const data = await get('/osrd/rolling_stock/');
        setRollingStock(data.results);
        setResultContent(data.results);
      } catch (e) {
        dispatch(setFailure({
          name: t('osrdconf:errorMessages.unableToRetrieveRollingStock'),
          message: e.message,
        }));
        console.log(e);
      }
    }
  };

  useEffect(() => {
    getAllMateriel();
  }, []);

  useEffect(() => {
    if (rollingStock !== undefined) {
      updateSearch();
    }
  }, [filters]);

  return (
    <>
      <div className="rollingstock-search p-2">
        <div className="rollingstock-search-filters">
          <div className="row">
            <div className="col-md-6 mb-3">
              <InputSNCF
                id="searchfilter"
                label={t('translation:common.filter')}
                type="text"
                onChange={searchMateriel}
                placeholder={t('translation:common.search')}
                noMargin
                clearButton
                sm
              />
            </div>
            <div className="col-md-6 mb-3 select-osrd-sm">
              <SelectSNCF
                id="sortfilter"
                name="sort"
                title={t('translation:common.sort')}
                options={optionsSort}
                selectedValue={{ id: 'asc', name: t('translation:common.asc') }}
                onChange={toggleFilter}
              />
            </div>
          </div>
          <div className="">
            <CheckboxRadioSNCF
              onChange={toggleFilter}
              name="elec"
              id="elec"
              label={(
                <>
                  <span className="text-primary mr-1"><BsLightningFill /></span>
                  Électrique
                </>
              )}
              type="checkbox"
              checked
            />
            <CheckboxRadioSNCF
              onChange={toggleFilter}
              name="diesel"
              id="diesel"
              label={(
                <>
                  <span className="text-pink mr-1"><MdLocalGasStation /></span>
                  Diesel
                </>
              )}
              type="checkbox"
              checked
            />
          </div>
          <div className="pt-3 text-center">
            {resultContent !== undefined && resultContent.length > 0
              ? `${resultContent.length} ${t('rollingstock:resultsFound')}` : t('rollingstock:noResultFound')}
          </div>
        </div>
        <div className="rollingstock-search-list">
          {resultContent !== undefined && !isFiltering
            ? resultContent.map((result) => displayMateriel(result))
            : <Loader msg={t('rollingstock:waitingLoader')} /> }
        </div>
      </div>
    </>
  );
}
