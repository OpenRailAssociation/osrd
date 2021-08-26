import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main.ts';
import { useTranslation } from 'react-i18next';
import { get, deleteRequest } from 'common/requests';
import TimetableSelectorModal from 'applications/osrd/components/TimetableSelector/TimetableSelectorModal';
import icon from 'assets/pictures/timetable.svg';
import { sec2time } from 'utils/timeManipulation';
import DotsLoader from 'common/DotsLoader/DotsLoader';

const timetableURL = '/osrd/timetable';
const scheduleURL = '/osrd/train_schedule';

export default function TimetableSelector(props) {
  const { mustUpdateTimetable } = props;
  const [selectedTimetable, setselectedTimetable] = useState(undefined);
  const [trainList, setTrainList] = useState(undefined);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const getTimetable = async (id) => {
    try {
      const timetableQuery = await get(`${timetableURL}/${id}`, {});
      timetableQuery.train_schedules.sort((a, b) => a.departure_time > b.departure_time);
      setselectedTimetable(timetableQuery);
      setTrainList(timetableQuery.train_schedules);
    } catch (e) {
      dispatch(setFailure({
        name: t('osrdconf:errorMessages.unableToRetrieveTimetable'),
        message: e.message,
      }));
      console.log('ERROR', e);
    }
  };

  const deleteTrainSchedule = async (id) => {
    await deleteRequest(`${scheduleURL}/${id}`);
    getTimetable(timetableID);
  };

  const formatTrainList = () => trainList.map((train, idx) => (
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
    } else {
      setselectedTimetable(undefined);
    }
  }, [timetableID, mustUpdateTimetable]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container osrd-config-item-clickable"
          role="button"
          tabIndex="-1"
          data-toggle="modal"
          data-target="#timetable-selector-modal"
        >
          <div className="h2 mb-0 d-flex align-items-center">
            <img width="32px" className="mr-2" src={icon} alt="timetableIcon" />
            <span className="text-muted">{t('osrdconf:timetable')}</span>
            {timetableID !== undefined && selectedTimetable === undefined
              ? <span className="ml-3"><DotsLoader /></span>
              : (
                <>
                  {selectedTimetable !== undefined ? (
                    <>
                      <span className="ml-1">{selectedTimetable.name}</span>
                      <small className="ml-1 text-primary flex-grow-1">{selectedTimetable.id}</small>
                      <span className="ml-2 badge badge-secondary">
                        {`${selectedTimetable.train_schedules.length} ${t('translation:common.train(s)')}`}
                      </span>
                    </>
                  ) : <span className="ml-1">{t('osrdconf:noTimetable')}</span> }
                </>
              )}
          </div>
        </div>
        {timetableID !== undefined && trainList !== undefined && trainList.length > 0 ? (
          <div className="osrd-config-item-container">
            <div className="timetable-trainlist">
              {formatTrainList(trainList)}
            </div>
          </div>
        ) : null }
      </div>
      <TimetableSelectorModal />
    </>
  );
}

TimetableSelector.propTypes = {
  mustUpdateTimetable: PropTypes.bool.isRequired,
};
