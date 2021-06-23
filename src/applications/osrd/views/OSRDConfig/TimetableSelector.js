import React, { useState, useEffect } from 'react';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import TimetableSelectorModal from 'applications/osrd/components/TimetableSelector/TimetableSelectorModal';
import icon from 'assets/pictures/layersicons/timetable.svg';
import { sec2time } from 'utils/timeManipulation';
import DotsLoader from 'common/DotsLoader/DotsLoader';

const timetableURL = '/osrd/timetable';
const trainscheduleURI = '/osrd/train_schedule';

const formatTrainList = (trainList) => trainList.map((train) => (
  <tr key={nextId()}>
    <td><div className="cell-inner">{train.train_name}</div></td>
    <td><div className="cell-inner">{sec2time(train.departure_time)}</div></td>
  </tr>
));

export default function TimetableSelector() {
  const [selectedTimetable, setselectedTimetable] = useState(undefined);
  const [trainList, setTrainList] = useState(undefined);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation();

  const getTimetable = async (id) => {
    try {
      const timetableQuery = await get(`${timetableURL}/${id}`, {});
      setselectedTimetable(timetableQuery);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const getTrainList = async () => {
    const trainListLocal = [];
    for (const trainschedule of selectedTimetable.train_schedules) {
      try {
        trainListLocal.push(await get(`${trainscheduleURI}/${trainschedule.id}`));
      } catch (e) {
        console.log('ERROR', e);
      }
    }
    trainListLocal.sort((a, b) => a.departure_time > b.departure_time);
    setTrainList(trainListLocal);
  };

  useEffect(() => {
    if (osrdconf.timetableID !== undefined) {
      getTimetable(osrdconf.timetableID);
    } else {
      setselectedTimetable(undefined);
    }
  }, [osrdconf.timetableID]);

  useEffect(() => {
    if (selectedTimetable !== undefined) {
      getTrainList();
    }
  }, [selectedTimetable]);

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
            <img className="mr-1" src={icon} alt="timetableIcon" />
            <span className="text-muted">{t('osrdconf:timetable')}</span>
            {osrdconf.timetableID !== undefined && selectedTimetable === undefined
              ? <span className="ml-3"><DotsLoader /></span>
              : (
                <>
                  {selectedTimetable !== undefined ? (
                    <>
                      <span className="ml-1">{selectedTimetable.name}</span>
                      <small className="ml-1 text-primary flex-grow-1">{selectedTimetable.id}</small>
                      <span className="ml-2 badge badge-primary">
                        {`${selectedTimetable.train_schedules.length} ${t('translation:common.train(s)')}`}
                      </span>
                    </>
                  ) : <span className="ml-1">{t('osrdconf:noTimetable')}</span> }
                </>
              )}
          </div>
          <div className="timetable-trainlist">
            <div className="table-wrapper">
              <div className="table-scroller dragscroll">
                <table className="table table-hover">
                  {trainList !== undefined ? formatTrainList(trainList) : null}
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <TimetableSelectorModal />
    </>
  );
}
