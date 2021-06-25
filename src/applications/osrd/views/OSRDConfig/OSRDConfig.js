import React, { useState, useEffect } from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import Itinerary from 'applications/osrd/views/OSRDConfig/Itinerary';
import Map from 'applications/osrd/views/OSRDConfig/Map';
import InfraSelector from 'applications/osrd/views/OSRDConfig/InfraSelector';
import TimetableSelector from 'applications/osrd/views/OSRDConfig/TimetableSelector';
import TrainCompoSelector from 'applications/osrd/views/OSRDConfig/TrainCompoSelector';
import AddTrainSchedule from 'applications/osrd/views/OSRDConfig/AddTrainSchedule';
import AddTrainLabels from 'applications/osrd/views/OSRDConfig/AddTrainLabels';
import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

export default function OSRDConfig() {
  const { fullscreen } = useSelector((state) => state.main);
  const dispatch = useDispatch();
  const { t } = useTranslation(['translation', 'osrdconf']);
  const [extViewport, setExtViewport] = useState(undefined);
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(updateViewport({
        ...extViewport,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [extViewport]);

  return (
    <main className={`osrd-config-mastcontainer mastcontainer${fullscreen ? ' fullscreen' : ''}`}>
      <div className="row m-0 px-1 py-3 h-100">
        <div className="col-sm-6 h-100">
          <InfraSelector />
          <TimetableSelector
            mustUpdateTimetable={mustUpdateTimetable}
            setMustUpdateTimetable={setMustUpdateTimetable}
          />
          <TrainCompoSelector />
          <Itinerary
            title={t('translation:common.itinerary')}
            updateExtViewport={setExtViewport}
          />
          <AddTrainLabels />
          <AddTrainSchedule
            mustUpdateTimetable={mustUpdateTimetable}
            setMustUpdateTimetable={setMustUpdateTimetable}
          />
        </div>
        <div className="col-sm-6 h-100">
          <div className="osrd-config-item osrd-config-item-map mb-2">
            <div className="osrd-config-item-container h-100 osrd-config-item-container-map">
              <Map />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
