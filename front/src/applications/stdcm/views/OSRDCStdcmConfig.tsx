import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { updateViewport } from 'reducers/map';
import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'applications/operationalStudies/components/ManageTrainSchedule/SpeedLimitByTagSelector';
import TimetableSelector from 'applications/operationalStudies/components/ManageTrainSchedule/TimetableSelector';

import StdcmSingleAllowance from 'applications/operationalStudies/components/SimulationResults/Allowances/withOSRDStdcmParams';

type OSRDStdcmConfigProps = {
  setCurrentStdcmRequestStatus: (status: string) => void;
};

export default function OSRDConfig({ setCurrentStdcmRequestStatus }: OSRDStdcmConfigProps) {
  const { darkmode } = useSelector((state: any) => state.main);

  const dispatch = useDispatch();
  const { t } = useTranslation([
    'translation',
    'operationalStudies/manageTrainSchedule',
    'allowances',
  ]);
  const [extViewport, setExtViewport] = useState({});
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(true);

  if (darkmode) {
    import('../styles/OSRDConfigDarkMode.scss');
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

  const commonItinerary: string = t('translation:common.itinerary');

  const itineraryProps = {
    title: commonItinerary,
    updateExtViewport: setExtViewport,
  };

  return (
    <main
      className="osrd-config-mastcontainer mastcontainer"
      style={{ paddingLeft: '0', paddingBottom: '0' }}
    >
      {/* use class from new workflow in future */}
      <div className="row m-0 px-1 py-3 h-100">
        <div className="col-md-7 col-lg-6">
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
          <Itinerary {...itineraryProps} />

          <div className="row">
            <div className="col-xl-6">
              <div className="osrd-config-item mb-2 osrd-config-item-container">
                <StdcmSingleAllowance
                  title={t('allowances:gridMarginBefore')}
                  typeKey="gridMarginBefore"
                />
              </div>
            </div>
            <div className="col-xl-6">
              <div className="osrd-config-item mb-2 osrd-config-item-container">
                <StdcmSingleAllowance
                  title={t('allowances:gridMarginAfter')}
                  typeKey="gridMarginAfter"
                />
              </div>
            </div>
            <div className="row">
              <div className="col-xl-12">
                <div className="osrd-config-item mb-2 osrd-config-item-container">
                  <StdcmSingleAllowance
                    title={t('allowances:standardAllowance')}
                    typeKey="standardStdcmAllowance"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="osrd-config-stdcm-apply">
            <button
              className="btn btn-sm  btn-primary "
              type="button"
              onClick={() => setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending)}
            >
              {t('operationalStudies/manageTrainSchedule:apply')}
              <span className="sr-only" aria-hidden="true">
                {t('operationalStudies/manageTrainSchedule:apply')}
              </span>
            </button>
          </div>
        </div>
        <div className="col-md-5 col-lg-6">
          <div className="osrd-config-item mb-2">
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
