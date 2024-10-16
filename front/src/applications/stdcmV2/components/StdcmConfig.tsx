import { useEffect, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLinkedPathSearch from './StdcmLinkedPathSearch';
import StdcmOrigin from './StdcmOrigin';
import StdcmSimulationParams from './StdcmSimulationParams';
import StdcmVias from './StdcmVias';
import StdcmWarningBox from './StdcmWarningBox';
import useStaticPathfinding from '../hooks/useStaticPathfinding';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../types';
import type { StdcmConfigErrors, StdcmSimulation, StdcmSimulationInputs } from '../types';
import checkStdcmConfigErrors from '../utils/checkStdcmConfigErrors';

/**
 * Inputs in different cards inside the StdcmConfig component come from the stdcm redux store.
 * SelectedSimulation is the simulation that is currently selected from the list of simulations.
 */
type StdcmConfigProps = {
  isDebugMode: boolean;
  isPending: boolean;
  launchStdcmRequest: () => Promise<void>;
  retainedSimulationIndex: number;
  selectedSimulation?: StdcmSimulation;
  setCurrentSimulationInputs: React.Dispatch<React.SetStateAction<StdcmSimulationInputs>>;
  showBtnToLaunchSimulation: boolean;
};

const StdcmConfig = ({
  isDebugMode,
  isPending,
  launchStdcmRequest,
  retainedSimulationIndex,
  selectedSimulation,
  setCurrentSimulationInputs,
  showBtnToLaunchSimulation,
}: StdcmConfigProps) => {
  const { t } = useTranslation('stdcm');

  const { infra } = useInfraStatus();
  const dispatch = useAppDispatch();
  const {
    updateGridMarginAfter,
    updateGridMarginBefore,
    updateStdcmStandardAllowance,
    updateOriginArrivalType,
    updateDestinationArrivalType,
  } = useOsrdConfActions() as StdcmConfSliceActions;

  const { getOrigin, getDestination, getPathSteps, getProjectID, getScenarioID, getStudyID } =
    useOsrdConfSelectors();
  const origin = useSelector(getOrigin);
  const pathSteps = useSelector(getPathSteps);
  const destination = useSelector(getDestination);
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);

  const pathfinding = useStaticPathfinding(infra);

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors>();

  const disabled = isPending || retainedSimulationIndex > -1;

  const inputsProps = {
    disabled,
    selectedSimulation,
    setCurrentSimulationInputs,
  };

  const startSimulation = () => {
    const isPathfindingFailed = !!pathfinding && pathfinding.status !== 'success';
    const formErrorsStatus = checkStdcmConfigErrors(
      isPathfindingFailed,
      origin,
      destination,
      compact(pathSteps),
      t
    );
    if (pathfinding?.status === 'success' && !formErrorsStatus) {
      launchStdcmRequest();
    } else {
      // The console error is only for debugging the user tests (temporary)
      console.warn('The form is not valid:', { pathfinding, formErrorsStatus });
      setFormErrors(formErrorsStatus);
    }
  };

  const removeOriginArrivalTime = () => {
    dispatch(updateOriginArrivalType(ArrivalTimeTypes.ASAP));
  };
  const removeDestinationArrivalTime = () => {
    dispatch(updateDestinationArrivalType(ArrivalTimeTypes.ASAP));
  };

  useEffect(() => {
    const isPathfindingFailed = !!pathfinding && pathfinding.status !== 'success';
    const formErrorsStatus = checkStdcmConfigErrors(
      isPathfindingFailed,
      origin,
      destination,
      [],
      t
    );
    setFormErrors(formErrorsStatus);
  }, [origin, destination, pathfinding]);

  // TODO: DROP STDCMV1: set those values by default in the store when <StdcmAllowances/> is not used anymore.
  useEffect(() => {
    if (!isDebugMode) {
      dispatch(updateGridMarginAfter(35));
      dispatch(updateGridMarginBefore(35));
      dispatch(updateStdcmStandardAllowance({ type: 'time_per_distance', value: 4.5 }));
    }
  }, [isDebugMode]);

  useEffect(() => {
    if (!infra || infra.state === 'CACHED') {
      setFormErrors(undefined);
    } else {
      setFormErrors({ errorType: StdcmConfigErrorTypes.INFRA_NOT_LOADED });
    }
  }, [infra]);

  return (
    <div className="stdcm-v2__body">
      {isDebugMode && (
        <div className="stdcm-simulation-parameters">
          <StdcmSimulationParams {...{ disabled, projectID, studyID, scenarioID }} />
        </div>
      )}
      <div className="d-flex">
        <div className="d-flex flex-column">
          <StdcmLinkedPathSearch />
          <div className="stdcm-v2-simulation-inputs">
            <div className="stdcm-v2-consist-container">
              <StdcmConsist {...inputsProps} />
            </div>
            <div className="stdcm-v2__separator" />
            <div className="stdcm-v2-simulation-itinerary">
              <StdcmOrigin {...inputsProps} origin={origin} />
              <StdcmVias {...inputsProps} />
              <StdcmDestination {...inputsProps} destination={destination} />
              <div
                className={cx('stdcm-v2-launch-request', {
                  'wizz-effect': pathfinding?.status !== 'success' || formErrors,
                })}
              >
                {showBtnToLaunchSimulation && (
                  <Button label={t('simulation.getSimulation')} onClick={startSimulation} />
                )}
                {formErrors && (
                  <StdcmWarningBox
                    errorInfos={formErrors}
                    removeOriginArrivalTime={removeOriginArrivalTime}
                    removeDestinationArrivalTime={removeDestinationArrivalTime}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="osrd-config-item-container osrd-config-item-container-map stdcm-v2-map">
          <Map
            hideAttribution
            hideItinerary
            preventPointSelection
            pathGeometry={pathfinding?.geometry}
            showStdcmAssets
          />
        </div>
        <div />
      </div>
    </div>
  );
};

export default StdcmConfig;
