import { noop } from 'lodash';
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import ScenarioExplorer from 'common/ScenarioExplorer/ScenarioExplorer';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import {
  getInfraID,
  getProjectID,
  getScenarioID,
  getStudyID,
  getTimetableID,
} from 'reducers/osrdconf/selectors';
import { getPresentSimulation, getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import RollingStockSelector from 'common/RollingStockSelector/WithRollingStockSelector';
import STDCMAllowances from '../components/STDCMAllowances';
import OSRDStdcmResults from './OSRDStdcmResults';

type OSRDStdcmConfigProps = {
  currentStdcmRequestStatus: string;
  setCurrentStdcmRequestStatus: (status: string) => void;
};

export default function OSRDConfig({
  currentStdcmRequestStatus,
  setCurrentStdcmRequestStatus,
}: OSRDStdcmConfigProps) {
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);
  const timetableID = useSelector(getTimetableID);
  const infraID = useSelector(getInfraID);
  const [showMap, setShowMap] = useState<boolean>(true);

  const { t } = useTranslation([
    'translation',
    'operationalStudies/manageTrainSchedule',
    'simulation',
  ]);

  const selectedTrain = useSelector(getSelectedTrain);
  const simulation = useSelector(getPresentSimulation);
  const shouldDisplayStdcmResult = simulation.trains[selectedTrain] !== undefined;

  return (
    <main
      className="osrd-config-mastcontainer mastcontainer"
      style={{ paddingLeft: '0', paddingBottom: '0' }}
    >
      {/* use class from new workflow in future */}
      <div className="row m-0 px-1 py-3 h-100">
        <div className="col-md-7 col-lg-4">
          <ScenarioExplorer
            globalProjectId={projectID}
            globalStudyId={studyID}
            globalScenarioId={scenarioID}
          />
          {projectID && studyID && scenarioID && timetableID && infraID && (
            <>
              <RollingStockSelector condensed />
              <SpeedLimitByTagSelector condensed />
              <Itinerary />
              <STDCMAllowances />
              <div className="osrd-config-stdcm-apply">
                {/* TODO: use RTK request status */}
                <button
                  className="btn btn-sm  btn-primary "
                  type="button"
                  onClick={() => {
                    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
                    setShowMap(false);
                  }}
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
          <div className="col-md-5 col-lg-8">
            <div className="osrd-config-item-container mb-2">
              {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success && (
                <div
                  role="button"
                  tabIndex={-1}
                  className="btn d-flex align-items-center mb-1 font-weight-bold"
                  onClick={() => setShowMap(!showMap)}
                >
                  {t('simulation:map')}
                  <i className={showMap ? 'icons-arrow-up ml-auto' : 'icons-arrow-down ml-auto'} />
                </div>
              )}
              <div className="osrd-config-item">
                {showMap && (
                  <div
                    className={`osrd-config-item-container osrd-config-item-container-map ${
                      currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success
                        ? 'stdcm-map-withSimulation'
                        : 'stdcm-map-noSimulation'
                    }`}
                  >
                    <Map />
                  </div>
                )}
              </div>
            </div>
            {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success &&
              shouldDisplayStdcmResult && <OSRDStdcmResults />}
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
