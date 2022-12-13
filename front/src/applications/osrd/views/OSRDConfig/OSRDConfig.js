import 'applications/osrd/views/OSRDConfig/OSRDConfig.scss';

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { updateViewport } from 'reducers/map';
import { STDCM_REQUEST_STATUS, MODES } from 'applications/osrd/consts';
import { makeEnumBooleans } from 'utils/constants';

import AddTrainLabels from 'applications/osrd/views/OSRDConfig/AddTrainLabels';
import AddTrainSchedule from 'applications/osrd/views/OSRDConfig/AddTrainSchedule';
import InfraSelector from 'applications/osrd/views/OSRDConfig/InfraSelector';
import Itinerary from 'applications/osrd/views/OSRDConfig/Itinerary';
import Map from 'applications/osrd/views/OSRDConfig/Map';
import RollingStockSelector from 'applications/osrd/views/OSRDConfig/RollingStockSelector';
import SpeedLimitByTagSelector from 'applications/osrd/views/OSRDConfig/SpeedLimitByTagSelector';
import TimetableSelector from 'applications/osrd/views/OSRDConfig/TimetableSelector';

import StdcmSingleAllowance from 'applications/osrd/components/Simulation/Allowances/withOSRDStdcmParams';

export default function OSRDConfig(props) {
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const mode = useSelector((state) => state.osrdconf.mode);
  const gridMarginBefore = useSelector((state) => state.osrdconf.gridMarginBefore);
  const gridMarginAfter = useSelector((state) => state.osrdconf.gridMarginAfter);
  const dispatch = useDispatch();
  const { t } = useTranslation(['translation', 'osrdconf', 'allowances']);
  const [extViewport, setExtViewport] = useState(undefined);
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);
  const { setCurrentStdcmRequestStatus } = props;

  const { isSimulation, isStdcm } = makeEnumBooleans(MODES, mode);

  if (darkmode) {
    import('./OSRDConfigDarkMode.scss');
  }

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
              <InfraSelector />
              <RollingStockSelector />
              <SpeedLimitByTagSelector />
            </div>
            <div className="col-xl-6">
              <TimetableSelector
                mustUpdateTimetable={mustUpdateTimetable}
                setMustUpdateTimetable={setMustUpdateTimetable}
              />
            </div>
          </div>
          <Itinerary title={t('translation:common.itinerary')} updateExtViewport={setExtViewport} />
          {isStdcm && (
            <div className="row">
              <div className="col-xl-6">
                <div className = "osrd-config-item mb-2 osrd-config-item-container">
                <StdcmSingleAllowance title={t('allowances:gridMarginBefore')} typeKey='gridMarginBefore' providedType={{type:'time', value:gridMarginBefore}}/>
                </div>
              </div>
              <div className="col-xl-6">
                <div className = "osrd-config-item mb-2 osrd-config-item-container"  >
                <StdcmSingleAllowance title={t('allowances:gridMarginAfter')} typeKey='gridMarginAfter' providedType={{type:'time', value:gridMarginAfter}}/>
                </div>
              </div>
            </div>
          )}

          {isSimulation && (
            <React.Fragment>
              <AddTrainLabels />
              <AddTrainSchedule
                mustUpdateTimetable={mustUpdateTimetable}
                setMustUpdateTimetable={setMustUpdateTimetable}
              />
            </React.Fragment>
          )}
          {isStdcm && (
            <div className="osrd-config-stdcm-apply">
              <button
                className="btn btn-sm  btn-primary "
                type="button"
                onClick={() => setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending)}
              >
                {t('osrdconf:apply')}
                <span className="sr-only" aria-hidden="true">
                  {t('osrdconf:apply')}
                </span>
              </button>
            </div>
          )}
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
  setCurrentStdcmRequestStatus: PropTypes.func,
};
OSRDConfig.defaultProps = {
  setCurrentStdcmRequestStatus: () => {},
};
