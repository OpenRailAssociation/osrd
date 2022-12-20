import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDispatch, useSelector } from 'react-redux';
import { getTimetableID } from 'reducers/osrdconf/selectors';
import { updateTimetableID } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';

export default function TimetableSelectorModalBodyStandard(props) {
  const { timetablesList, filter, setFilter } = props;
  const { t } = useTranslation(['translation', 'timetableManagement']);
  const dispatch = useDispatch();
  const timetableID = useSelector(getTimetableID);

  return (
    <>
      <div className="timetable-input-filter">
        <InputSNCF
          id="timetablelist-filter-choice"
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
          <button
            type="button"
            onClick={() => dispatch(updateTimetableID(timetable.id))}
            data-dismiss="modal"
            className={`timetableslist-item-choice ${timetable.id === timetableID ? 'active' : ''}`}
            key={nextId()}
          >
            <div className="timetableslist-item-choice-main">
              <span className="timetableslist-item-choice-name">{timetable.name}</span>
            </div>
            <div className="timetableslist-item-choice-footer">
              <span className="">ID {timetable.id}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

TimetableSelectorModalBodyStandard.defaultProps = {
  filter: '',
};

TimetableSelectorModalBodyStandard.propTypes = {
  filter: PropTypes.string,
  timetablesList: PropTypes.array.isRequired,
  setFilter: PropTypes.func.isRequired,
};
