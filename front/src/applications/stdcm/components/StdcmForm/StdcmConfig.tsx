import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import { extractMarkersInfo } from 'applications/stdcm/utils';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import useWorkerStatus from 'modules/pathfinding/hooks/useWorkerStatus';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import {
  restoreStdcmConfig,
  updateInitialConsist,
  updateStdcmPathStep,
} from 'reducers/osrdconf/stdcmConf';
import {
  getOperationalPoints,
  getTrackSectionIdsByLoadingGauge,
  getStdcmConf,
  getStdcmDestination,
  getStdcmInfraID,
  getStdcmOrigin,
  getStdcmPathSteps,
  getStdcmProjectID,
  getStdcmScenarioID,
  getStdcmStudyID,
  getStdcmTimetableID,
  getLoadingGauge,
  getStdcmRollingStockID,
  getTotalMass,
  getTotalLength,
  getMaxSpeed,
  getTowedRollingStockID,
  getStdcmSpeedLimitByTag,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';

import useStaticPathfinding from '../../hooks/useStaticPathfinding';
import type {
  ConsistData,
  StdcmConfigErrors,
  ConsistErrors,
  StdcmProgressPoints,
  StdcmRequestStatus,
} from '../../types';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../../types';
import checkStdcmConfigErrors from '../../utils/checkStdcmConfigErrors';
import StdcmLoader from '../StdcmLoader';
import StdcmMapProgressLayer from '../StdcmMapProgressLayer';
import StdcmSimulationParams from '../StdcmSimulationParams';
import StdcmWarningBox from '../StdcmWarningBox';
import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLinkedTrainSearch from './StdcmLinkedTrainSearch';
import StdcmOrigin from './StdcmOrigin';
import StdcmVias from './StdcmVias';

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
  requestStatus: StdcmRequestStatus;
  retainedSimulationIndex?: number;
  showBtnToLaunchSimulation: boolean;
  skipPathfindingStatusMessage: boolean;
  launchStdcmRequest: () => Promise<void>;
  cancelStdcmRequest: () => void;
  setSkipPathfindingStatusMessage: (value: boolean) => void;
  progressPoints: RefObject<StdcmProgressPoints>;
};

const StdcmConfig = ({
  isDebugMode,
  requestStatus,
  retainedSimulationIndex,
  showBtnToLaunchSimulation,
  skipPathfindingStatusMessage,
  setSkipPathfindingStatusMessage,
  cancelStdcmRequest,
  launchStdcmRequest,
  progressPoints,
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
  const rollingStockID = useSelector(getStdcmRollingStockID);
  const towedRollingStockID = useSelector(getTowedRollingStockID);
  const totalMass = useSelector(getTotalMass);
  const totalLength = useSelector(getTotalLength);
  const maxSpeed = useSelector(getMaxSpeed);
  const speedLimitByTag = useSelector(getStdcmSpeedLimitByTag);
  const projectID = useSelector(getStdcmProjectID);
  const studyID = useSelector(getStdcmStudyID);
  const scenarioID = useSelector(getStdcmScenarioID);
  const operationalPoints = useSelector(getOperationalPoints);
  const trackSectionIdsByLoadingGauge = useSelector(getTrackSectionIdsByLoadingGauge);
  const loadingGaugeType = useSelector(getLoadingGauge);

  const initialConsist: ConsistData = {
    rollingStockID,
    towedRollingStockID,
    totalMass,
    totalLength,
    maxSpeed,
  };

  const onInitialConsistChange = useCallback(
    (newConsist: ConsistData) => {
      dispatch(updateInitialConsist(newConsist));
    },
    [dispatch]
  );

  const mapSettings = useMapSettings();

  // Keep local state of the viewport to keep stdcm config and stdcm results maps independent
  const [stdcmConfigViewport, setStdcmConfigViewport] = useState<Viewport>(mapSettings.viewport);

  const updateViewport = (viewport: Viewport) => {
    setStdcmConfigViewport(viewport);
  };

  const { updateMapSettings: updateMapSettingsAction } = useMapSettingsActions();
  const updateMapSettings = useCallback(
    (value: Partial<MapSettings>) => {
      dispatch(updateMapSettingsAction(value));
    },
    [dispatch]
  );

  const {
    pathfinding,
    pathfindingStatusMessage,
    showPathfindingStatusMessage,
    setShowPathfindingStatusMessage,
  } = useStaticPathfinding(pathfindingWorkerStatus, infra);

  const formRef = useRef<HTMLDivElement>(null);
  const pathfindingBannerRef = useRef<HTMLDivElement>(null);

  const [submittedFormErrors, setSubmittedFormErrors] = useState<StdcmConfigErrors>();

  const [initialConsistErrors, setInitialConsistErrors] = useState<ConsistErrors>({
    totalMass: { message: undefined, display: false, type: 'missing' },
    totalLength: { message: undefined, display: false, type: 'missing' },
    maxSpeed: { message: undefined, display: false, type: 'missing' },
  });

  const [viaConsistErrors, setViaConsistErrors] = useState<ConsistErrors[]>([]);

  const consistErrors = useMemo(
    () => [initialConsistErrors, ...viaConsistErrors],
    [initialConsistErrors, viaConsistErrors]
  );

  const formErrors = useMemo(() => {
    if (!submittedFormErrors) return undefined;
    return checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      stdcmConf,
      prevFormErrors: submittedFormErrors,
      consistErrors,
      shouldCheckMandatoryFields: false,
    });
  }, [t, dateTimeLocale, stdcmConf, consistErrors, submittedFormErrors]);

  const disabled =
    requestStatus === STDCM_REQUEST_STATUS.in_progress ||
    requestStatus === STDCM_REQUEST_STATUS.pending ||
    retainedSimulationIndex !== undefined;

  const markersInfo = useMemo(() => extractMarkersInfo(pathSteps), [pathSteps]);

  const startSimulation = async () => {
    const formErrorsStatus = checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      prevFormErrors: submittedFormErrors,
      consistErrors,
      shouldCheckMandatoryFields: true,
    });

    setSubmittedFormErrors(formErrorsStatus);

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

  const updatedFormErrors = useMemo((): StdcmConfigErrors | undefined => {
    if (pathfindingWorkerStatus !== 'READY' || stdcmWorkerStatus !== 'READY') {
      return { errorType: StdcmConfigErrorTypes.INFRA_NOT_LOADED };
    }
    if (!origin.operationalPoint || !destination.operationalPoint) return undefined;
    return checkStdcmConfigErrors({
      t,
      dateTimeLocale,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      consistErrors,
      shouldCheckMandatoryFields: false,
    });
  }, [
    pathfindingWorkerStatus,
    stdcmWorkerStatus,
    origin,
    destination,
    pathfinding,
    t,
    dateTimeLocale,
    stdcmConf,
    consistErrors,
  ]);

  useEffect(() => {
    const state = window.osrdStdcmConfState;
    if (state) {
      dispatch(restoreStdcmConfig(state));
    }
  }, []);

  useLayoutEffect(() => {
    const bannerElement = pathfindingBannerRef.current;
    if (!showPathfindingStatusMessage || !bannerElement) {
      return undefined;
    }

    const handleAnimationEnd = () => {
      setShowPathfindingStatusMessage(false);
    };

    bannerElement.addEventListener('animationend', handleAnimationEnd);

    return () => {
      bannerElement.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [showPathfindingStatusMessage]);

  const isLoading = useMemo(
    () =>
      requestStatus === STDCM_REQUEST_STATUS.in_progress ||
      requestStatus === STDCM_REQUEST_STATUS.pending ||
      requestStatus === STDCM_REQUEST_STATUS.pending_additional,
    [requestStatus]
  );

  const effectiveFormErrors = updatedFormErrors ?? formErrors;

  return (
    <div className="stdcm__body">
      {isDebugMode && (
        <div className="stdcm-simulation-parameters">
          <StdcmSimulationParams {...{ disabled, projectID, studyID, scenarioID }} />
        </div>
      )}
      <div className="d-flex">
        <div className="stdcm-parameters">
          <StdcmLinkedTrainSearch
            disabled={disabled}
            linkedTrainType="anterior"
            linkedOpId={origin.id}
          />
          <StdcmConsist
            disabled={disabled}
            isDebugMode={isDebugMode}
            onConsistErrorsChange={setInitialConsistErrors}
            consist={{
              rollingStockID,
              towedRollingStockID,
              totalMass,
              totalLength,
              maxSpeed,
              loadingGauge: loadingGaugeType,
              speedLimitByTag,
            }}
            onConsistChange={onInitialConsistChange}
          />
          <div className="stdcm__separator" />
          <StdcmOrigin disabled={disabled} onItineraryChange={onItineraryChange} />
          <StdcmVias
            disabled={disabled}
            isDebugMode={isDebugMode}
            skipAnimation={skipPathfindingStatusMessage}
            onItineraryChange={onItineraryChange}
            initialConsist={initialConsist}
            initialConsistErrors={initialConsistErrors}
            onHasViaConsistErrorsChange={setViaConsistErrors}
          />
          <StdcmDestination disabled={disabled} onItineraryChange={onItineraryChange} />
          <StdcmLinkedTrainSearch
            disabled={disabled}
            linkedTrainType="posterior"
            linkedOpId={destination.id}
          />

          <div
            className={cx('stdcm-launch-request', {
              'wizz-effect': pathfinding?.status !== 'success' || effectiveFormErrors,
            })}
            ref={launchButtonRef}
          >
            {effectiveFormErrors && (
              <StdcmWarningBox
                infra={infra}
                workerStatus={pathfindingWorkerStatus}
                errorInfos={effectiveFormErrors}
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
                effectiveFormErrors?.errorType === StdcmConfigErrorTypes.INFRA_NOT_LOADED
              }
            />
          </div>
          {showPathfindingStatusMessage && !skipPathfindingStatusMessage && (
            <div className="simulation-status-banner">
              <div className="banner-content">
                <div
                  ref={pathfindingBannerRef}
                  data-testid="pathfinding-status-message"
                  className={cx('pathfinding-status', {
                    'pathfinding-status-success': pathfinding?.status === 'success',
                  })}
                >
                  {pathfindingStatusMessage}
                </div>
              </div>
            </div>
          )}
          {isLoading && (
            <StdcmLoader
              requestStatus={requestStatus}
              cancelStdcmRequest={cancelStdcmRequest}
              launchButtonRef={launchButtonRef}
              formRef={formRef}
            />
          )}
        </div>

        <div className="osrd-config-item-container osrd-config-item-container-map stdcm-map">
          <DefaultBaseMap
            mapId="stdcm-map-config"
            infraId={infra?.id}
            highlightedOperationalPoints={operationalPoints}
            highlightedTrackSections={
              trackSectionIdsByLoadingGauge && loadingGaugeType
                ? trackSectionIdsByLoadingGauge[loadingGaugeType]
                : undefined
            }
            mapSettings={{ ...mapSettings, viewport: stdcmConfigViewport }}
            pathStepMarkers={markersInfo}
            updateMapSettings={updateMapSettings}
            updateViewport={updateViewport}
          >
            {isLoading && <StdcmMapProgressLayer progressPoints={progressPoints} />}
          </DefaultBaseMap>
        </div>
      </div>
    </div>
  );
};

export default StdcmConfig;
