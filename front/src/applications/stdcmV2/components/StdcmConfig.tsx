import { useEffect, useMemo, useState } from 'react';

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
import StdcmOrigin from './StdcmOrigin';
import StdcmSimulationParams from './StdcmSimulationParams';
import StdcmVias from './StdcmVias';
import StdcmWarningBox from './StdcmWarningBox';
import useStaticPathfinding from '../hooks/useStaticPathfinding';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../types';
import type { StdcmConfigErrors } from '../types';
import checkStdcmConfigErrors from '../utils/checkStdcmConfigErrors';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';

/**
 * Inputs in different cards inside the StdcmConfig component come from the stdcm redux store.
 * SelectedSimulation is the simulation that is currently selected from the list of simulations.
 */
type StdcmConfigProps = {
  isDebugMode: boolean;
  isPending: boolean;
  launchStdcmRequest: () => Promise<void>;
  retainedSimulationIndex: number;
  showBtnToLaunchSimulation: boolean;
};

const StdcmConfig = ({
  isDebugMode,
  isPending,
  launchStdcmRequest,
  retainedSimulationIndex,
  showBtnToLaunchSimulation,
}: StdcmConfigProps) => {
  const { t } = useTranslation('stdcm');

  const { infra } = useInfraStatus();
  const dispatch = useAppDispatch();
  const {
    updateGridMarginAfter,
    updateGridMarginBefore,
    updateStdcmStandardAllowance,
    updateStdcmPathStep,
  } = useOsrdConfActions() as StdcmConfSliceActions;

  const {
    getStdcmOrigin,
    getStdcmDestination,
    getStdcmPathSteps,
    getProjectID,
    getScenarioID,
    getStudyID,
  } = useOsrdConfSelectors() as StdcmConfSelectors;
  const origin = useSelector(getStdcmOrigin);
  const pathSteps = useSelector(getStdcmPathSteps);
  const destination = useSelector(getStdcmDestination);
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);

  const pathStepsLocations = useMemo(
    () => pathSteps.map((step) => step.location || null),
    [pathSteps]
  );

  const pathfinding = useStaticPathfinding(pathStepsLocations, infra);

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors>();

  const disabled = isPending || retainedSimulationIndex > -1;

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
    dispatch(updateStdcmPathStep({ ...origin, arrivalType: ArrivalTimeTypes.ASAP }));
  };
  const removeDestinationArrivalTime = () => {
    dispatch(updateStdcmPathStep({ ...destination, arrivalType: ArrivalTimeTypes.ASAP }));
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

  useEffect(() => console.log(origin), [origin]);

  return (
    <div className="stdcm-v2__body">
      {isDebugMode && (
        <div className="stdcm-simulation-parameters">
          <StdcmSimulationParams {...{ disabled, projectID, studyID, scenarioID }} />
        </div>
      )}

      <div className="d-flex">
        <div className="stdcm-v2-simulation-inputs">
          <div className="stdcm-v2-consist-container">
            <StdcmConsist disabled={disabled} />
          </div>
          <div className="stdcm-v2__separator" />
          <div className="stdcm-v2-simulation-itinerary">
            {/* //TODO: use them when we implement this feature #403 */}
            {/* <StdcmDefaultCard text="Indiquer le sillon antérieur" Icon={<ArrowUp size="lg" />} /> */}
            <StdcmOrigin disabled={disabled} />
            <StdcmVias disabled={disabled} />
            <StdcmDestination disabled={disabled} />
            {/* <StdcmDefaultCard text="Indiquer le sillon postérieur" Icon={<ArrowDown size="lg" />} /> */}
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
