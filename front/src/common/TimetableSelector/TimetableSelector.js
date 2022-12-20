import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import { get, deleteRequest } from 'common/requests';
import { getTimetableID } from 'reducers/osrdconf/selectors';
import { trainscheduleURI } from 'applications/osrd/components/Simulation/consts';
import { sec2time } from 'utils/timeManipulation';
import icon from 'assets/pictures/components/trains_timetable.svg';
import TimetableSelectorModal from './TimetableSelectorModal';
import './TimetableSelector.scss';

const TIMETABLE_URL = '/timetable/';

export default function TimetableSelector(props) {
  const { modalOnly, modalID } = props;
  const dispatch = useDispatch();
  const [selectedTimetable, setSelectedTimetable] = useState(undefined);
  const [trainList, setTrainList] = useState(undefined);
  const timetableID = useSelector(getTimetableID);

  const { t } = useTranslation(['timetableManagement']);

  const getTimetable = async (id) => {
    try {
      const timetableQuery = await get(`${TIMETABLE_URL}${id}/`, {});
      timetableQuery.train_schedules.sort((a, b) => a.departure_time > b.departure_time);
      setSelectedTimetable(timetableQuery);
      setTrainList(timetableQuery.train_schedules);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('timetableManagement:errorMessages.unableToRetrieveTimetable'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
    }
  };

  const deleteTrainSchedule = async (id) => {
    await deleteRequest(`${trainscheduleURI}${id}/`);
    getTimetable(timetableID);
  };

  const formatTrainList = () =>
    trainList.map((train, idx) => (
      <div key={nextId()} className="row align-items-center timetable-trainlist-train">
        <div className="col-7">
          <span className="small text-primary mr-1">{idx + 1}</span>
          {train.train_name}
        </div>
        <div className="col-3">{sec2time(train.departure_time)}</div>
        <div className="col-2">
          <button
            type="button"
            className="btn btn-sm btn-only-icon btn-white"
            onClick={() => deleteTrainSchedule(train.id)}
          >
            <i className="icons-close" />
          </button>
        </div>
      </div>
    ));

  useEffect(() => {
    if (timetableID !== undefined) {
      getTimetable(timetableID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetableID]);

  if (modalOnly) return <TimetableSelectorModal modalID={modalID} />;

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container osrd-config-item-clickable"
          role="button"
          tabIndex="-1"
          data-toggle="modal"
          data-target={`#${modalID}`}
        >
          <div className="infraselector-button">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            {selectedTimetable !== undefined ? (
              <>
                <span className="">{selectedTimetable.name}</span>
                <span className="ml-1 small align-self-center">({selectedTimetable.id})</span>
              </>
            ) : (
              t('timetableManagement:chooseTimetable')
            )}
          </div>
        </div>
        {timetableID !== undefined && trainList !== undefined && trainList.length > 0 ? (
          <div className="osrd-config-item-container">
            <div className="timetable-trainlist">{formatTrainList(trainList)}</div>
          </div>
        ) : null}
      </div>
      <TimetableSelectorModal modalID={modalID} />
    </>
  );
}

TimetableSelector.defaultProps = {
  modalOnly: false,
  modalID: `timetable-selector-modal-${nextId()}`,
};
TimetableSelector.propTypes = {
  modalOnly: PropTypes.bool,
  modalID: PropTypes.string,
};
