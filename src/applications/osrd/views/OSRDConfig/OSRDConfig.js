import React, { useState, useEffect } from 'react';
import { FlyToInterpolator } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import Itinerary from 'applications/osrd/views/OSRDConfig/Itinerary';
import Map from 'applications/osrd/components/Map/Map';
import TrainCompoSelector from 'applications/osrd/views/OSRDConfig/TrainCompoSelector';
import SimulationLauncher from 'applications/osrd/views/OSRDConfig/SimulationLauncher';
import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

export default function OSRDConfig() {
  const { fullscreen } = useSelector((state) => state.main);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [extViewport, setExtViewport] = useState(undefined);

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
          <SimulationLauncher title={t('osrd.config.simulation')} />
          <TrainCompoSelector title={t('osrd.config.composition')} modalID="trainCompoModal" />
          <Itinerary
            title={t('common.itinerary')}
            updateExtViewport={setExtViewport}
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
