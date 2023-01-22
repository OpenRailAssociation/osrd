import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { updateViewport } from 'reducers/map';

import AddTrainLabels from 'applications/operationalStudies/components/ManageTrainSchedule/AddTrainLabels';
import AddTrainSchedule from 'applications/operationalStudies/components/ManageTrainSchedule/AddTrainSchedule';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'applications/operationalStudies/components/ManageTrainSchedule/SpeedLimitByTagSelector';

export default function ManageTrainSchedule() {
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
    <>
      <div className="manage-train-schedule-title">
        1. Choisissez un matériel
      </div>
      <div className="row no-gutters">
        <div className="col-xl-6 pr-xl-2">
          <RollingStockSelector />
        </div>
        <div className="col-xl-6">
          <SpeedLimitByTagSelector />
        </div>
      </div>
      <div className="manage-train-schedule-title">
        2. Déterminez l'itinéraire
      </div>
      <div className="row no-gutters">
        <div className="col-xl-6 pr-xl-2">
          <Itinerary title={t('translation:common.itinerary')} updateExtViewport={setExtViewport} />
        </div>
        <div className="col-xl-6">
          <div className="osrd-config-item mb-2">
            <div className="osrd-config-item-container osrd-config-item-container-map">
              <Map />
            </div>
          </div>
        </div>
      </div>
      <div className="manage-train-schedule-title">
        3. Ajustez et validez
      </div>
      <AddTrainLabels />
      <AddTrainSchedule
        mustUpdateTimetable={mustUpdateTimetable}
        setMustUpdateTimetable={setMustUpdateTimetable}
      />
    </>
  );
}
