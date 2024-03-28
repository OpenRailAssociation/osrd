import React, { useEffect, useMemo, useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import RunningTime from 'applications/stdcm/components/RunningTime';
import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import type { StdcmRequestStatus } from 'applications/stdcm/types';
import OSRDStdcmResults from 'applications/stdcm/views/OSRDStdcmResults';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useInfraID, useOsrdConfSelectors } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import ScenarioExplorer from 'modules/scenario/components/ScenarioExplorer';
import StdcmAllowances from 'modules/stdcmAllowances/components/StdcmAllowances';
import { Itinerary, Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/consts';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';

type OSRDStdcmConfigProps = {
  currentStdcmRequestStatus: string;
  setCurrentStdcmRequestStatus: (currentStdcmRequestStatus: StdcmRequestStatus) => void;
};

export default function OSRDConfig({
  currentStdcmRequestStatus,
  setCurrentStdcmRequestStatus,
}: OSRDStdcmConfigProps) {
  const { getConf, getProjectID, getScenarioID, getStudyID, getTimetableID } =
    useOsrdConfSelectors();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);
  const timetableID = useSelector(getTimetableID);
  const infraID = useInfraID();
  const selectedTrain = useSelector(getSelectedTrain);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [isInfraLoaded, setIsInfraLoaded] = useState<boolean>(false);

  const osrdconf: OsrdStdcmConfState = useSelector(getConf) as OsrdStdcmConfState;

  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();

  const { rollingStockComfort, rollingStock } = useStoreDataForRollingStockSelector();

  const { t } = useTranslation(['translation', 'stdcm', 'simulation']);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraById.useQuery(
    { id: infraID as number },
    {
      skip: !infraID,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
    }
  );

  const shouldDisplayStdcmResult = selectedTrain !== undefined;

  const disabledApplyButton = useMemo(
    () =>
      infra?.state !== 'CACHED' ||
      !osrdconf.origin ||
      !osrdconf.destination ||
      !(osrdconf.originTime || osrdconf.destinationTime) ||
      (osrdconf.originTime &&
        osrdconf.originUpperBoundTime &&
        osrdconf.originTime > osrdconf.originUpperBoundTime) ||
      !osrdconf.rollingStockID,
    [infra, osrdconf]
  );

  useEffect(() => {
    if (infra && infra.state === 'NOT_LOADED') {
      setIsInfraLoaded(false);
    }

    if (infra && infra.state === 'CACHED') {
      setIsInfraLoaded(true);
    }
  }, [infra]);

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
              <RollingStockSelector
                condensed
                rollingStockSelected={rollingStock}
                rollingStockComfort={rollingStockComfort}
              />
              <SpeedLimitByTagSelector
                condensed
                selectedSpeedLimitByTag={speedLimitByTag}
                speedLimitsByTags={speedLimitsByTags}
                dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
              />
              <Itinerary />
              <RunningTime />
              <StdcmAllowances />
              <div className="osrd-config-stdcm-apply">
                {/* TODO: use RTK request status */}
                <button
                  data-testid="applyStdcmButton"
                  className="btn btn-sm  btn-primary "
                  type="button"
                  disabled={disabledApplyButton}
                  onClick={() => {
                    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
                  }}
                >
                  {t('stdcm:apply')}
                  <span className="sr-only" aria-hidden="true">
                    {t('stdcm:apply')}
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
                  <span className="ml-auto">{showMap ? <ChevronUp /> : <ChevronDown />}</span>
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
