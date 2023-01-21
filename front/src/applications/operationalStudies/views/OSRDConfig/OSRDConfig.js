import 'applications/operationalStudies/views/OSRDConfig/OSRDConfig.scss';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { updateViewport } from 'reducers/map';

import AddTrainLabels from 'applications/operationalStudies/views/OSRDConfig/AddTrainLabels';
import AddTrainSchedule from 'applications/operationalStudies/views/OSRDConfig/AddTrainSchedule';
import Itinerary from 'applications/operationalStudies/views/OSRDConfig/Itinerary';
import Map from 'applications/operationalStudies/views/OSRDConfig/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'applications/operationalStudies/views/OSRDConfig/SpeedLimitByTagSelector';

export default function ManageTrainSchedule() {
  const { fullscreen } = useSelector((state) => state.main);

  const dispatch = useDispatch();
  const { t } = useTranslation(['translation', 'osrdconf', 'allowances']);
  const [extViewport, setExtViewport] = useState(undefined);
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extViewport]);

  return (
    <main className={`osrd-config-mastcontainer mastcontainer${fullscreen ? ' fullscreen' : ''}`}>
      <div className="row m-0 px-1 py-3 h-100">
        <div className="col-sm-6">
          <div className="row">
            <div className="col-xl-6">
              <RollingStockSelector />
              <SpeedLimitByTagSelector />
            </div>
          </div>
          <Itinerary title={t('translation:common.itinerary')} updateExtViewport={setExtViewport} />
          <AddTrainLabels />
          <AddTrainSchedule
            mustUpdateTimetable={mustUpdateTimetable}
            setMustUpdateTimetable={setMustUpdateTimetable}
          />
        </div>
        <div className="col-sm-6">
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
