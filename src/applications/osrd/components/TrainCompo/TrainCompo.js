import React, { useState, useEffect } from 'react';
import Loader from 'common/Loader';
import { useSelector, useDispatch } from 'react-redux';
import { getBaseGoc, getMateriel } from 'reducers/traincompo';
import { useTranslation } from 'react-i18next';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import TrainCompoCard from 'applications/osrd/components/TrainCompo/TrainCompoCard';
import TrainCompoDetails from 'applications/osrd/components/TrainCompo/TrainCompoDetails';
import { BsLightningFill } from 'react-icons/bs';
import { MdLocalGasStation } from 'react-icons/md';
import 'applications/osrd/components/TrainCompo/TrainCompo.scss';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export default function TrainCompo() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const traincompo = useSelector((state) => state.traincompo);

  const [resultContent, setResultContent] = useState(traincompo.materiel.results);
  const [detailsContent, setDetailsContent] = useState(undefined);
  const [filters, setFilters] = useState({
    text: '',
    thor: true,
    cim: true,
    elec: true,
    diesel: true,
    sort: true, // true for ASC, false for DESC
  });
  const [isFiltering, setIsFiltering] = useState(false);

  const searchMateriel = (e) => {
    setFilters({ ...filters, text: e.target.value.toLowerCase() });
    setIsFiltering(true);
  };

  const updateSearch = () => {
    // Text filter
    let resultContentNew = traincompo.materiel.results.filter(
      (el) => el.name.toLowerCase().includes(filters.text),
    );

    // checkbox filters
    if (!filters.thor) {
      resultContentNew = resultContentNew.filter((el) => el.source !== 'THOR');
    }
    if (!filters.cim) {
      resultContentNew = resultContentNew.filter((el) => el.source !== 'CIM');
    }
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

  const displayDetails = async (codenbengin) => {
    const detailsContentNew = await dispatch(getBaseGoc(codenbengin));
    setDetailsContent(detailsContentNew);
  };

  const displayMateriel = (result) => {
    const active = (detailsContent !== undefined
      && detailsContent.codenbengin === result.codenbengin);
    return (
      <TrainCompoCard
        data={result}
        displayDetails={displayDetails}
        active={active}
        key={result.codenbengin}
      />
    );
  };

  const toggleFilter = (e) => {
    setFilters({ ...filters, [e.target.name]: !filters[e.target.name] });
    setIsFiltering(true);
  };

  const optionsSort = [
    { id: 'asc', name: t('common.asc') },
    { id: 'dsc', name: t('common.dsc') },
  ];

  const getAllMateriel = async () => {
    if (traincompo.materiel.results === undefined) {
      const data = await dispatch(getMateriel());
      setResultContent(data.results);
    }
  };

  useEffect(() => {
    getAllMateriel();
  }, []);

  useEffect(() => {
    if (traincompo.materiel.results !== undefined) {
      updateSearch();
    }
  }, [filters]);

  return (
    <>
      <div className="row m-0 h-100">
        <div className="col-lg-5 h-100">
          <div className="traincompo-search p-2">
            <div className="traincompo-search-filters">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <InputSNCF
                    id="searchfilter"
                    label={t('common.filter')}
                    type="text"
                    onChange={searchMateriel}
                    placeholder={t('common.search')}
                    noMargin
                    sm
                  />
                </div>
                <div className="col-md-6 mb-3 select-osrd-sm">
                  <SelectSNCF
                    id="sortfilter"
                    name="sort"
                    title={t('common.sort')}
                    options={optionsSort}
                    selectedValue={{ id: 'asc', name: t('common.asc') }}
                    onChange={toggleFilter}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-6">
                  <CheckboxRadioSNCF onChange={toggleFilter} name="thor" id="thor" label="Source THOR" type="checkbox" checked />
                  <CheckboxRadioSNCF onChange={toggleFilter} name="cim" id="cim" label="Source CIM" type="checkbox" checked />
                </div>
                <div className="col-6">
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
              </div>
              <div className="text-center w-100 mt-3">
                {resultContent !== undefined && resultContent.length > 0 ? `${resultContent.length} ${t('osrd.trainCompo.resultsFound')}` : t('osrd.trainCompo.noResultFound')}
              </div>
            </div>
            <div className="traincompo-search-list">
              {resultContent !== undefined && !isFiltering
                ? resultContent.map((result) => displayMateriel(result))
                : <Loader msg={t('osrd.trainCompo.waitingLoader')} /> }
            </div>
          </div>
        </div>
        <div className="col-lg-7 h-100">
          {detailsContent !== undefined ? <TrainCompoDetails data={detailsContent} /> : null}
        </div>
      </div>
    </>
  );
}
