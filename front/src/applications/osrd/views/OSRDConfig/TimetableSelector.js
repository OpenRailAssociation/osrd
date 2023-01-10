import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import { get, deleteRequest } from 'common/requests';
import TimetableSelectorModal from 'applications/osrd/components/TimetableSelector/TimetableSelectorModal';
import icon from 'assets/pictures/components/trains_timetable.svg';
import { sec2time } from 'utils/timeManipulation';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { trainscheduleURI } from 'applications/osrd/components/Simulation/consts';
import { updateTimetableID } from 'reducers/osrdconf';
import { ModalContext } from  'common/BootstrapSNCF/ModalSNCF/ModalProvider';

const timetableURL = '/timetable/';

export default function TimetableSelector(props) {
  const { mustUpdateTimetable, setMustUpdateTimetable } = props;
  const { openModal } = useContext(ModalContext);
  const [selectedTimetable, setSelectedTimetable] = useState(undefined);
  const [isWorking, setIsWorking] = useState(false);
  const [trainList, setTrainList] = useState(undefined);
  const timetableID = useSelector((state) => state.osrdconf.timetableID);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const getTimetable = async (id) => {
    setIsWorking(true);
    try {
      const timetableQuery = await get(`${timetableURL}${id}/`, {});
      timetableQuery.train_schedules.sort((a, b) => a.departure_time > b.departure_time);
      setSelectedTimetable(timetableQuery);
      setTrainList(timetableQuery.train_schedules);
      setIsWorking(false);
    } catch (e) {
      dispatch(updateTimetableID(undefined));
      dispatch(
        setFailure({
          name: t('osrdconf:errorMessages.unableToRetrieveTimetable'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
      setIsWorking(false);
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
    if (timetableID !== undefined && mustUpdateTimetable) {
      getTimetable(timetableID);
      setMustUpdateTimetable(false);
    } else {
      setSelectedTimetable(undefined);
      setMustUpdateTimetable(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustUpdateTimetable]);

  useEffect(() => {
    if (timetableID !== undefined) {
      getTimetable(timetableID);
    } else {
      setSelectedTimetable(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetableID, mustUpdateTimetable]);

  const timeTable = () => {
    if (isWorking) {
      return (
        <span className="ml-3">
          <DotsLoader />
        </span>
      );
    }
    if (selectedTimetable !== undefined) {
      return (
        <>
          <span className="ml-1">{selectedTimetable.name}</span>
          <small className="ml-1 text-primary flex-grow-1">{selectedTimetable.id}</small>
          <span className="ml-2 badge badge-secondary">
            {`${selectedTimetable.train_schedules.length} ${t('translation:common.train(s)')}`}
          </span>
        </>
      );
    }
    return <span className="ml-1">{t('osrdconf:noTimetable')}</span>;
  };

  return (
    <div className="osrd-config-item mb-2">
      <div
        className="osrd-config-item-container osrd-config-item-clickable"
        role="button"
        tabIndex="-1"
        onClick={() => openModal(<TimetableSelectorModal />)}
      >
        <div className="d-flex align-items-center">
          <img width="32px" className="mr-2" src={icon} alt="timetableIcon" />
          {timeTable()}
        </div>
      </div>
      {timetableID !== undefined && trainList !== undefined && trainList.length > 0 ? (
        <div className="osrd-config-item-container">
          <div className="timetable-trainlist">{formatTrainList(trainList)}</div>
        </div>
      ) : null}
    </div>
  );
}

TimetableSelector.propTypes = {
  mustUpdateTimetable: PropTypes.bool.isRequired,
  setMustUpdateTimetable: PropTypes.func.isRequired,
};
