import { noop } from 'lodash';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { updateViewport } from 'reducers/map';
import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import ScenarioExplorator from 'common/ScenarioExplorator/ScenarioExplorator';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'applications/operationalStudies/components/ManageTrainSchedule/SpeedLimitByTagSelector';

import StdcmSingleAllowance from 'applications/operationalStudies/components/SimulationResults/Allowances/withOSRDStdcmParams';
import {
  getInfraID,
  getProjectID,
  getScenarioID,
  getStudyID,
  getTimetableID,
} from 'reducers/osrdconf/selectors';

type OSRDStdcmConfigProps = {
  setCurrentStdcmRequestStatus: (status: string) => void;
};

export default function OSRDConfig({ setCurrentStdcmRequestStatus }: OSRDStdcmConfigProps) {
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);
  const timetableID = useSelector(getTimetableID);
  const infraID = useSelector(getInfraID);

  const dispatch = useDispatch();
  const { t } = useTranslation([
    'translation',
    'operationalStudies/manageTrainSchedule',
    'allowances',
  ]);
  const [extViewport, setExtViewport] = useState({});

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
          <ScenarioExplorator />
          {projectID && studyID && scenarioID && timetableID && infraID && (
            <>
              <RollingStockSelector />
              <SpeedLimitByTagSelector />
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
            </>
          )}
        </div>
        {projectID && studyID && scenarioID && timetableID && infraID && (
          <div className="col-md-5 col-lg-6">
            <div className="osrd-config-item mb-2">
              <div className="osrd-config-item-container osrd-config-item-container-map">
                <Map />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

OSRDConfig.propTypes = {
  setCurrentStdcmRequestStatus: PropTypes.func,
};
OSRDConfig.defaultProps = {
  setCurrentStdcmRequestStatus: noop,
};
