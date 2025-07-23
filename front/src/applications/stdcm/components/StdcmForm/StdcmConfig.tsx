import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { extractMarkersInfo } from 'applications/stdcm/utils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import useWorkerStatus from 'modules/pathfinding/hooks/useWorkerStatus';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { useMapSettings } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import { resetMargins, restoreStdcmConfig, updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import {
  getActivePerimeter,
  getOperationalPoints,
  getStdcmConf,
  getStdcmDestination,
  getStdcmInfraID,
  getStdcmOrigin,
  getStdcmPathSteps,
  getStdcmProjectID,
  getStdcmRollingStockID,
  getStdcmScenarioID,
  getStdcmStudyID,
  getStdcmTimetableID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';

import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLinkedTrainSearch from './StdcmLinkedTrainSearch';
import StdcmOrigin from './StdcmOrigin';
import useStaticPathfinding from '../../hooks/useStaticPathfinding';
import type { StdcmConfigErrors, ConsistErrors } from '../../types';
import StdcmSimulationParams from '../StdcmSimulationParams';
import StdcmVias from './StdcmVias';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../../types';
import checkStdcmConfigErrors from '../../utils/checkStdcmConfigErrors';
import StdcmLoader from '../StdcmLoader';
import StdcmWarningBox from '../StdcmWarningBox';
import StdcmMapActivePerimeter from './StdcmMapActivePerimeter';

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    osrdStdcmConfState?: OsrdStdcmConfState;
  }
}

/**
 * Inputs in different cards inside the StdcmConfig component come from the stdcm redux store.
 * SelectedSimulation is the simulation that is currently selected from the list of simulations.
 */
type StdcmConfigProps = {
  isDebugMode: boolean;
  isPending: boolean;
  isPendingAdditional: boolean;
  retainedSimulationIndex?: number;
  showBtnToLaunchSimulation: boolean;
  skipPathfindingStatusMessage: boolean;
  launchStdcmRequest: () => Promise<void>;
  cancelStdcmRequest: () => void;
  setSkipPathfindingStatusMessage: (value: boolean) => void;
};

const StdcmConfig = ({
  isDebugMode,
  isPending,
  isPendingAdditional,
  retainedSimulationIndex,
  showBtnToLaunchSimulation,
  skipPathfindingStatusMessage,
  setSkipPathfindingStatusMessage,
  cancelStdcmRequest,
  launchStdcmRequest,
}: StdcmConfigProps) => {
  const { t } = useTranslation('stdcm');
  const dateTimeLocale = useDateTimeLocale();
  const launchButtonRef = useRef<HTMLDivElement>(null);

  const infraId = useSelector(getStdcmInfraID);
  const timetableId = useSelector(getStdcmTimetableID);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery({
    infraId: infraId,
  });

  // We need to load 2 infras:
  // - 1 infra without any timetableId, which will be used for the pathfinding requests
  // - 1 infra with the timetableId, which will be used for the stdcm request (faster since the timetable will be cached)
  // The form is disabled until both workers have fully loaded.
  const pathfindingWorkerStatus = useWorkerStatus({ infraId });
  const stdcmWorkerStatus = useWorkerStatus({ infraId, timetableId });

  const dispatch = useAppDispatch();

  const stdcmConf = useSelector(getStdcmConf);

  const origin = useSelector(getStdcmOrigin);
  const pathSteps = useSelector(getStdcmPathSteps);
  const destination = useSelector(getStdcmDestination);
  const rollingStockId = useSelector(getStdcmRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({ rollingStockId });
  const projectID = useSelector(getStdcmProjectID);
  const studyID = useSelector(getStdcmStudyID);
  const scenarioID = useSelector(getStdcmScenarioID);
  const activePerimeter = useSelector(getActivePerimeter);
  const operationalPoints = useSelector(getOperationalPoints);

  const mapSettings = useMapSettings();

  // Keep local state of the viewport to keep stdcm config and stdcm results maps independent
  const [stdcmConfigViewport, setStdcmConfigViewport] = useState<Viewport>(mapSettings.viewport);

  const updateViewport = (viewport: Viewport) => {
    setStdcmConfigViewport(viewport);
  };

  const [showMessage, setShowMessage] = useState(false);

  const { pathfinding, isPathFindingLoading } = useStaticPathfinding(
    pathfindingWorkerStatus,
    infra
  );

  const formRef = useRef<HTMLDivElement>(null);
  const pathfindingBannerRef = useRef<HTMLDivElement>(null);

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors>();

  const [consistErrors, setConsistErrors] = useState<ConsistErrors>({
    totalMass: { message: undefined, display: false, type: 'missing' },
    totalLength: { message: undefined, display: false, type: 'missing' },
    maxSpeed: { message: undefined, display: false, type: 'missing' },
  });

  const disabled = isPending || retainedSimulationIndex !== undefined;

  const markersInfo = useMemo(() => extractMarkersInfo(pathSteps), [pathSteps]);

  const startSimulation = async () => {
    const formErrorsStatus = checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      prevFormErrors: formErrors,
      consistErrors,
      shouldCheckMandatoryFields: true,
    });

    setFormErrors(formErrorsStatus);

    if (pathfinding?.status === 'success' && !formErrorsStatus) {
      launchStdcmRequest();
    } else {
      // The console error is only for debugging the user tests (temporary)
      console.warn('The form is not valid:', { pathfinding, formErrorsStatus });
    }
  };

  const removeOriginArrivalTime = () => {
    dispatch(
      updateStdcmPathStep({ id: origin.id, updates: { arrivalType: ArrivalTimeTypes.ASAP } })
    );
  };

  const removeDestinationArrivalTime = () => {
    dispatch(
      updateStdcmPathStep({ id: destination.id, updates: { arrivalType: ArrivalTimeTypes.ASAP } })
    );
  };

  const onItineraryChange = () => setSkipPathfindingStatusMessage(false);

  const getStatusMessage = () => {
    if (isPathFindingLoading) {
      return t('pathfindingStatus.calculating');
    }
    return t('pathfindingStatus.success');
  };

  // Checks for live warnings regarding pathSteps
  useEffect(() => {
    if (pathfindingWorkerStatus !== 'READY' || stdcmWorkerStatus !== 'READY') {
      setFormErrors({ errorType: StdcmConfigErrorTypes.INFRA_NOT_LOADED });
      return;
    } else {
      setFormErrors(undefined);
    }

    if (!origin.location || !destination.location) return;

    const formErrorsStatus = checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      prevFormErrors: formErrors,
      consistErrors,
      shouldCheckMandatoryFields: false,
    });
    setFormErrors(formErrorsStatus);
  }, [pathfinding, pathSteps, t, consistErrors, pathfindingWorkerStatus, stdcmWorkerStatus]);

  useEffect(() => {
    if (!isDebugMode) {
      dispatch(resetMargins());
    }
  }, [isDebugMode]);

  useEffect(() => {
    const state = window.osrdStdcmConfState;
    if (state) {
      dispatch(restoreStdcmConfig(state));
    }
  }, []);

  useEffect(() => {
    if (!skipPathfindingStatusMessage && isPathFindingLoading) {
      setShowMessage(true);
    }

    if (pathfinding?.status === 'failure') {
      setShowMessage(false);
    }
  }, [isPathFindingLoading, pathfinding?.status, skipPathfindingStatusMessage]);

  useLayoutEffect(() => {
    const bannerElement = pathfindingBannerRef.current;
    if (!showMessage || !bannerElement) {
      return undefined;
    }

    const handleAnimationEnd = () => {
      setShowMessage(false);
    };

    bannerElement.addEventListener('animationend', handleAnimationEnd);

    return () => {
      bannerElement.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [showMessage]);

  useEffect(() => {
    const updatedErrors = checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      stdcmConf,
      prevFormErrors: formErrors,
      consistErrors,
      shouldCheckMandatoryFields: false,
    });

    // Prevent clearing formErrors if pathfindingFailed is still active
    if (
      (formErrors?.errorType === StdcmConfigErrorTypes.PATHFINDING_FAILED ||
        formErrors?.errorType === StdcmConfigErrorTypes.INFRA_NOT_LOADED) &&
      !updatedErrors
    ) {
      return;
    }

    if (!isEqual(updatedErrors, formErrors)) {
      setFormErrors(updatedErrors);
    }
  }, [t, formErrors, consistErrors, rollingStock, stdcmConf]);

  return (
    <div className="stdcm__body">
      {isDebugMode && (
        <div className="stdcm-simulation-parameters">
          <StdcmSimulationParams {...{ disabled, projectID, studyID, scenarioID }} />
        </div>
      )}
      <div className="d-flex">
        <div className="d-flex flex-column">
          <StdcmLinkedTrainSearch
            disabled={disabled}
            linkedTrainType="anterior"
            linkedOpId={origin.id}
          />
          <div className="stdcm-simulation-inputs">
            <div className="stdcm-consist-container">
              <StdcmConsist
                disabled={disabled}
                isDebugMode={isDebugMode}
                consistErrors={consistErrors}
                setConsistErrors={setConsistErrors}
              />
            </div>
            <div className="stdcm__separator" />
            <div ref={formRef} className="stdcm-simulation-itinerary">
              <StdcmOrigin disabled={disabled} onItineraryChange={onItineraryChange} />
              <StdcmVias
                disabled={disabled}
                skipAnimation={skipPathfindingStatusMessage}
                onItineraryChange={onItineraryChange}
              />
              <StdcmDestination disabled={disabled} onItineraryChange={onItineraryChange} />
              <StdcmLinkedTrainSearch
                disabled={disabled}
                linkedTrainType="posterior"
                linkedOpId={destination.id}
              />

              <div
                className={cx('stdcm-launch-request', {
                  'wizz-effect': pathfinding?.status !== 'success' || formErrors,
                })}
                ref={launchButtonRef}
              >
                {formErrors && (
                  <StdcmWarningBox
                    infra={infra}
                    workerStatus={pathfindingWorkerStatus}
                    errorInfos={formErrors}
                    removeOriginArrivalTime={removeOriginArrivalTime}
                    removeDestinationArrivalTime={removeDestinationArrivalTime}
                  />
                )}
                <Button
                  dataTestID="launch-simulation-button"
                  className={cx({
                    'fade-out': !isDebugMode && !showBtnToLaunchSimulation,
                  })}
                  label={t('simulation.getSimulation')}
                  onClick={startSimulation}
                  isDisabled={
                    disabled ||
                    (!isDebugMode && !showBtnToLaunchSimulation) ||
                    formErrors?.errorType === StdcmConfigErrorTypes.INFRA_NOT_LOADED
                  }
                />
              </div>
              {showMessage && (
                <div className="simulation-status-banner">
                  <div className="banner-content">
                    <div
                      ref={pathfindingBannerRef}
                      data-testid="pathfinding-status-message"
                      className={cx('pathfinding-status', {
                        'pathfinding-status-success': pathfinding?.status === 'success',
                      })}
                    >
                      {getStatusMessage()}
                    </div>
                  </div>
                </div>
              )}
              {(isPending || isPendingAdditional) && (
                <StdcmLoader
                  isPendingAdditional={isPendingAdditional}
                  cancelStdcmRequest={cancelStdcmRequest}
                  launchButtonRef={launchButtonRef}
                  formRef={formRef}
                />
              )}
            </div>
          </div>
        </div>

        <div className="osrd-config-item-container osrd-config-item-container-map stdcm-map">
          <DefaultBaseMap
            mapId="stdcm-map-config"
            infraId={infra?.id}
            pathStepMarkers={markersInfo}
            highlightedArea={activePerimeter}
            highlightedOperationalPoints={operationalPoints}
            mapSettings={{ ...mapSettings, viewport: stdcmConfigViewport }}
            updateViewport={updateViewport}
          >
            <StdcmMapActivePerimeter />
          </DefaultBaseMap>
        </div>
      </div>
    </div>
  );
};

export default StdcmConfig;
