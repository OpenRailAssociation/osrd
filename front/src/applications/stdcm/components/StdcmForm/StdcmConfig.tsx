import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useStdcmConsist from 'applications/stdcm/hooks/useStdcmConsist';
import { extractMarkersInfo } from 'applications/stdcm/utils';
import filterMissingFields from 'applications/stdcm/utils/filterMissingFields';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { resetMargins, restoreStdcmConfig, updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import {
  getStdcmConf,
  getStdcmDestination,
  getStdcmInfraID,
  getStdcmOrigin,
  getStdcmPathSteps,
  getStdcmProjectID,
  getStdcmRollingStockID,
  getStdcmScenarioID,
  getStdcmSelectedLayers,
  getStdcmStudyID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLinkedTrainSearch from './StdcmLinkedTrainSearch';
import StdcmOrigin from './StdcmOrigin';
import useStaticPathfinding from '../../hooks/useStaticPathfinding';
import type { StdcmConfigErrors } from '../../types';
import StdcmSimulationParams from '../StdcmSimulationParams';
import StdcmVias from './StdcmVias';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../../types';
import checkStdcmConfigErrors from '../../utils/checkStdcmConfigErrors';
import StdcmLoader from '../StdcmLoader';
import StdcmWarningBox from '../StdcmWarningBox';

declare global {
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
  const launchButtonRef = useRef<HTMLDivElement>(null);

  const infraId = useSelector(getStdcmInfraID);
  const { infra } = useInfraStatus({ infraId });

  const dispatch = useAppDispatch();

  const stdcmConf = useSelector(getStdcmConf);

  const origin = useSelector(getStdcmOrigin);
  const pathSteps = useSelector(getStdcmPathSteps);
  const destination = useSelector(getStdcmDestination);
  const rollingStockId = useSelector(getStdcmRollingStockID);
  const { rollingStock } = useStoreDataForRollingStockSelector({ rollingStockId });
  const { totalMass, totalLength, maxSpeed } = useStdcmConsist();
  const projectID = useSelector(getStdcmProjectID);
  const studyID = useSelector(getStdcmStudyID);
  const scenarioID = useSelector(getStdcmScenarioID);
  const stdcmLayers = useSelector(getStdcmSelectedLayers);

  const [showMessage, setShowMessage] = useState(false);

  const { pathfinding, isPathFindingLoading } = useStaticPathfinding(infra);

  const formRef = useRef<HTMLDivElement>(null);
  const pathfindingBannerRef = useRef<HTMLDivElement>(null);

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors>();

  const disabled = isPending || retainedSimulationIndex !== undefined;

  const markersInfo = useMemo(() => extractMarkersInfo(pathSteps), [pathSteps]);

  const startSimulation = async () => {
    const formErrorsStatus = checkStdcmConfigErrors({
      t,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      prevFormErros: formErrors,
      shouldCheckMandatoryFields: true,
    });

    setFormErrors(formErrorsStatus);

    if (pathfinding?.status === 'success' && !formErrorsStatus) {
      launchStdcmRequest();
    } else {
      // The console error is only for debugging the user tests (temporary)
      console.warn('The form is not valid:', { pathfinding, formErrorsStatus });
      setFormErrors(formErrorsStatus);
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
    if (!origin.location || !destination.location) return;

    const formErrorsStatus = checkStdcmConfigErrors({
      t,
      pathfindingStatus: pathfinding?.status,
      stdcmConf,
      prevFormErros: formErrors,
    });
    setFormErrors(formErrorsStatus);
  }, [pathfinding, pathSteps, t]);

  useEffect(() => {
    if (!infra || infra.state === 'CACHED') {
      setFormErrors(undefined);
    } else {
      setFormErrors({ errorType: StdcmConfigErrorTypes.INFRA_NOT_LOADED });
    }
  }, [infra]);

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
    const handleAnimationEnd = () => {
      setShowMessage(false);
    };

    if (!showMessage || formErrors) {
      return undefined;
    }
    pathfindingBannerRef.current!.addEventListener('animationend', handleAnimationEnd);

    return () => {
      pathfindingBannerRef.current?.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [showMessage, formErrors]);

  useEffect(() => {
    if (
      formErrors?.errorType !== StdcmConfigErrorTypes.MISSING_INFORMATIONS ||
      !formErrors.errorDetails?.missingFields
    ) {
      return;
    }

    const updatedMissingFields = filterMissingFields({
      missingFields: formErrors.errorDetails.missingFields,
      rollingStock,
      totalMass,
      totalLength,
      maxSpeed,
      origin,
      destination,
    });

    const previousFields = formErrors.errorDetails.missingFields;
    const hasChanged =
      previousFields.length !== updatedMissingFields.length ||
      previousFields.some((field, i) => field !== updatedMissingFields[i]);

    if (updatedMissingFields.length === 0) {
      setFormErrors(undefined);
      return;
    }

    if (hasChanged) {
      setFormErrors({
        errorType: StdcmConfigErrorTypes.MISSING_INFORMATIONS,
        errorDetails: {
          missingFields: updatedMissingFields,
        },
      });
    }
  }, [
    formErrors,
    rollingStockId,
    rollingStock,
    totalMass,
    totalLength,
    maxSpeed,
    origin,
    destination,
  ]);

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
              <StdcmConsist disabled={disabled} isDebugMode={isDebugMode} />
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
                    errorInfos={formErrors}
                    removeOriginArrivalTime={removeOriginArrivalTime}
                    removeDestinationArrivalTime={removeDestinationArrivalTime}
                  />
                )}
                <Button
                  data-testid="launch-simulation-button"
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

              {!formErrors && showMessage && (
                <div className="simulation-status-banner">
                  <div className="banner-content">
                    <div
                      ref={pathfindingBannerRef}
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
            layersSettings={stdcmLayers}
          />
        </div>
      </div>
    </div>
  );
};

export default StdcmConfig;
