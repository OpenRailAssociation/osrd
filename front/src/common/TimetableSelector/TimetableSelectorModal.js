import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { getInfraID } from 'reducers/osrdconf/selectors';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import icon from 'assets/pictures/components/trains_timetable.svg';
import { get } from 'common/requests';
import { useDebounce } from 'utils/helpers';
import Loader from 'common/Loader';
import { MdClose, MdEditNote, MdList } from 'react-icons/md';
import TimetableSelectorModalBodyEdition from './TimetableSelectorModalBodyEdition';
import TimetableSelectorModalBodyStandard from './TimetableSelectorModalBodyStandard';

const TIMETABLE_URL = '/timetable/';

export default function TimetableSelectorModal(props) {
  const { modalID } = props;
  const [editionMode, setEditionMode] = useState(false);
  const [filter, setFilter] = useState('');
  const [filteredTimetablesList, setFilteredTimetablesList] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const infraID = useSelector(getInfraID);
  const [timetablesList, setTimetablesList] = useState(undefined);
  const { t } = useTranslation(['translation', 'timetableManagement']);

  const debouncedFilter = useDebounce(filter, 250);

  function filterTimetables(filteredTimetablesListLocal) {
    if (debouncedFilter && debouncedFilter !== '') {
      filteredTimetablesListLocal = timetablesList.results.filter((timetable) =>
        timetable.name.toLowerCase().includes(debouncedFilter.toLowerCase())
      );
    }
    filteredTimetablesListLocal = timetablesList.results.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setFilteredTimetablesList(filteredTimetablesListLocal);
  }

  const getTimetablesList = async () => {
    setIsFetching(true);
    try {
      const timetablesListQuery = await get(TIMETABLE_URL, { infra: infraID });
      setTimetablesList(timetablesListQuery);
      filterTimetables(timetablesListQuery);
      setIsFetching(false);
    } catch (e) {
      console.log('ERROR', e);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (timetablesList) {
      filterTimetables(timetablesList.results);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilter]);

  useEffect(() => {
    getTimetablesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  return (
    <ModalSNCF htmlID={modalID} size={editionMode ? 'lg' : 'md'}>
      <ModalHeaderSNCF>
        <div className="d-flex align-items-center h1 w-100">
          <img src={editionMode ? icon : icon} alt="timetable schema" width="32px" />
          <span className="w-100 text-center">
            {editionMode
              ? t('timetableManagement:timetableManagement')
              : t('timetableManagement:timetableChoice')}
          </span>
        </div>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        {isFetching ? (
          <div className="timetable-loader-absolute">
            <Loader position="center" />
          </div>
        ) : null}
        {editionMode ? (
          <TimetableSelectorModalBodyEdition
            timetablesList={filteredTimetablesList}
            setFilter={setFilter}
            filter={filter}
            getTimetablesList={getTimetablesList}
          />
        ) : (
          <TimetableSelectorModalBodyStandard
            timetablesList={filteredTimetablesList}
            setFilter={setFilter}
            filter={filter}
          />
        )}
        <div className="row mt-3">
          <div className="col-md-6">
            <button
              className="btn btn-secondary btn-sm btn-block"
              type="button"
              data-dismiss="modal"
            >
              <MdClose />
              <span className="ml-2">{t('translation:common.close')}</span>
            </button>
          </div>
          <div className="col-md-6">
            <button
              className="btn btn-primary btn-sm btn-block "
              type="button"
              onClick={() => setEditionMode(!editionMode)}
            >
              {editionMode ? (
                <>
                  <MdList />
                  <span className="ml-2">{t('timetableManagement:goToStandardMode')}</span>
                </>
              ) : (
                <>
                  <MdEditNote />
                  <span className="ml-2">{t('timetableManagement:goToEditionMode')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </ModalBodySNCF>
    </ModalSNCF>
  );
}

TimetableSelectorModal.propTypes = {
  modalID: PropTypes.string.isRequired,
};
