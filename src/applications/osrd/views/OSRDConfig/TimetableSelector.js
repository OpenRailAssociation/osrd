import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';
import TimetableSelectorModal from 'applications/osrd/components/TimetableSelector/TimetableSelectorModal';
import icon from 'assets/pictures/layersicons/timetable.svg';

const timetableURL = '/osrd/timetable';

export default function TimetableSelector() {
  const [selectedTimetable, setselectedTimetable] = useState(undefined);
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

  useEffect(() => {
    if (osrdconf.timetableID !== undefined) {
      getTimetable(osrdconf.timetableID);
    }
  }, [osrdconf.timetableID]);

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
          <div className="h2 mb-0">
            <img className="mr-1" src={icon} alt="timetableIcon" />
            <span className="text-muted">{t('osrdconf:timetable')}</span>
            {selectedTimetable !== undefined ? (
              <>
                <span className="ml-1">{selectedTimetable.name}</span>
                <small className="ml-1 text-primary">{selectedTimetable.id}</small>
              </>
            ) : <span className="ml-1">{t('osrdconf:noTimetable')}</span> }
          </div>
        </div>
      </div>
      <TimetableSelectorModal />
    </>
  );
}
