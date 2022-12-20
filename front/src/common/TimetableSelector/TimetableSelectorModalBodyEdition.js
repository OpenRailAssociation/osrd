import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { post } from 'common/requests';
import { updateTimetableID } from 'reducers/osrdconf';
import { getInfraID } from 'reducers/osrdconf/selectors';
import TimetableSelectorEditionItem from './TimetableSelectorEditionItem';

const TIMETABLE_URL = '/timetable/';

export default function TimetableSelectorModalBodyEdition(props) {
  const { timetablesList, setFilter, filter, getTimetablesList } = props;
  const dispatch = useDispatch();
  const [isFocused, setIsFocused] = useState();
  const [runningDelete, setRunningDelete] = useState();
  const [nameNewTimetable, setNameNewTimetable] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const infraID = useSelector(getInfraID);
  const { t } = useTranslation(['translation', 'timetableManagement']);

  async function addNewTimetable() {
    const params = {
      name: nameNewTimetable,
      infra: infraID,
    };
    if (nameNewTimetable !== '') {
      try {
        const result = await post(TIMETABLE_URL, params, {});
        dispatch(updateTimetableID(result.id));
      } catch (e) {
        console.log(e);
      }
      getTimetablesList();
      setErrorMessage(undefined);
    }
  }

  return (
    <div className="row">
      <div className="col-md-7">
        <div className="timetable-input-filter">
          <InputSNCF
            id="timetablelist-filter-manage"
            sm
            onChange={(e) => setFilter(e.target.value)}
            value={filter}
            type="text"
            noMargin
            unit={<i className="icons-search" />}
          />
        </div>
        <div className="text-center small text-muted">
          {timetablesList
            ? `${timetablesList.length} ${t('timetableManagement:timetablesFound')}`
            : null}
        </div>
        <div className="timetableslist">
          {timetablesList.map((timetable) => (
            <TimetableSelectorEditionItem
              timetable={timetable}
              key={nextId()}
              isFocused={isFocused}
              runningDelete={runningDelete}
              setRunningDelete={setRunningDelete}
              setIsFocused={setIsFocused}
              getTimetablesList={getTimetablesList}
            />
          ))}
        </div>
      </div>
      <div className="col-md-5">
        <h1 className="text-center text-success mb-1">
          {t('timetableManagement:createTimetable')}
        </h1>
        <div className="timetable-add">
          <InputSNCF
            id="timetable-add"
            sm
            onChange={(e) => setNameNewTimetable(e.target.value)}
            value={nameNewTimetable}
            type="text"
            noMargin
            placeholder={t('timetableManagement:timetableName')}
          />
          <div className="timetable-add-error">{errorMessage}</div>
          <button
            className="btn btn-sm btn-success btn-block text-wrap"
            onClick={addNewTimetable}
            type="button"
          >
            {t('timetableManagement:addTimetable')}
          </button>
        </div>
      </div>
    </div>
  );
}

TimetableSelectorModalBodyEdition.defaultProps = {
  filter: '',
};

TimetableSelectorModalBodyEdition.propTypes = {
  filter: PropTypes.string,
  timetablesList: PropTypes.array.isRequired,
  setFilter: PropTypes.func.isRequired,
  getTimetablesList: PropTypes.func.isRequired,
};
