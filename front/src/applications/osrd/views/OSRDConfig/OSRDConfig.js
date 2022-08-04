import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import AddTrainLabels from 'applications/osrd/views/OSRDConfig/AddTrainLabels';
import AddTrainSchedule from 'applications/osrd/views/OSRDConfig/AddTrainSchedule';
import { FlyToInterpolator } from 'react-map-gl';
import InfraSelector from 'applications/osrd/views/OSRDConfig/InfraSelector';
import Itinerary from 'applications/osrd/views/OSRDConfig/Itinerary';
import Map from 'applications/osrd/views/OSRDConfig/Map';
import PropTypes from 'prop-types';
import RollingStockSelector from 'applications/osrd/views/OSRDConfig/RollingStockSelector';
import TimetableSelector from 'applications/osrd/views/OSRDConfig/TimetableSelector';
import { updateViewport } from 'reducers/map';
import { useTranslation } from 'react-i18next';

export default function OSRDConfig(props) {
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const dispatch = useDispatch();
  const { t } = useTranslation(['translation', 'osrdconf']);
  const [extViewport, setExtViewport] = useState(undefined);
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);

  const { mode } = props

  if (darkmode) {
    import('./OSRDConfigDarkMode.scss');
  }

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
        <div className="col-sm-6">
          { mode === 'stdcm' && (<b>TEST</b>)}
          <InfraSelector />
          <TimetableSelector
            mustUpdateTimetable={mustUpdateTimetable}
            setMustUpdateTimetable={setMustUpdateTimetable}
          />
          <RollingStockSelector />
          <Itinerary
            title={t('translation:common.itinerary')}
            updateExtViewport={setExtViewport}
            mode={mode}
          />
          <AddTrainLabels />
          { mode === 'simulation' &&
            (
              <AddTrainSchedule
                mustUpdateTimetable={mustUpdateTimetable}
                setMustUpdateTimetable={setMustUpdateTimetable}
              />
            )
          }

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

OSRDConfig.propTypes = {
  mode: PropTypes.oneOf(['simulation', 'stdcm'])
}

OSRDConfig.defaultProps = {
  mode: 'simulation'
}
