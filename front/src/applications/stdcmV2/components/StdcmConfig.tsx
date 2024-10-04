import { useRef, useEffect, useState } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { usePathfinding } from 'modules/pathfinding/hooks/usePathfinding';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';
import { extractHHMMFromDate } from 'utils/date';

import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLoader from './StdcmLoader';
import StdcmOrigin from './StdcmOrigin';
import StdcmSimulationParams from './StdcmSimulationParams';
import StdcmStatusBanner from './StdcmStatusBanner';
import StdcmVias from './StdcmVias';
import StdcmWarningBox from './StdcmWarningBox';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../types';
import type { StdcmConfigErrors, StdcmSimulation } from '../types';
import checkStdcmConfigErrors from '../utils/checkStdcmConfigErrors';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import usePathfindingIsPossible from '../hooks/usePathfindingIsPossible';

/**
 * Inputs in different cards inside the StdcmConfig component come from the stdcm redux store.
 * SelectedSimulation is the simulation that is currently selected from the list of simulations.
 */
type StdcmConfigProps = {
  cancelStdcmRequest: () => void;
  isCalculationFailed: boolean;
  isDebugMode: boolean;
  isPending: boolean;
  launchStdcmRequest: () => Promise<void>;
  retainedSimulationIndex: number;
  selectedSimulation?: StdcmSimulation;
  showBtnToLaunchSimulation: boolean;
  showStatusBanner: boolean;
};

const StdcmConfig = ({
  cancelStdcmRequest,
  isCalculationFailed,
  isDebugMode,
  isPending,
  launchStdcmRequest,
  retainedSimulationIndex,
  selectedSimulation,
  showBtnToLaunchSimulation,
  showStatusBanner,
}: StdcmConfigProps) => {
  const { t } = useTranslation('stdcm');
  const loaderRef = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();
  const {
    updateGridMarginAfter,
    updateGridMarginBefore,
    updateStdcmStandardAllowance,
    updateStdcmPathStep,
  } = useOsrdConfActions() as StdcmConfSliceActions;

  const { getStdcmOrigin, getStdcmDestination, getProjectID, getScenarioID, getStudyID } =
    useOsrdConfSelectors() as StdcmConfSelectors;
  const origin = useSelector(getStdcmOrigin);
  const destination = useSelector(getStdcmDestination);
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);

  const [pathfindingProperties, setPathfindingProperties] =
    useState<ManageTrainSchedulePathProperties>();

  const pathfindingStatus = usePathfindingIsPossible();

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors>();

  const disabled = isPending || retainedSimulationIndex > -1;

  const inputsProps = {
    disabled,
    selectedSimulation,
  };

  const startSimulation = () => {
    if (pathfindingStatus === 'success' && !formErrors) {
      launchStdcmRequest();
    }
  };

  const removeOriginArrivalTime = () =>
    dispatch(updateStdcmPathStep({ ...origin, arrivalType: ArrivalTimeTypes.ASAP }));
  const removeDestinationArrivalTime = () =>
    dispatch(updateStdcmPathStep({ ...destination, arrivalType: ArrivalTimeTypes.ASAP }));

  useEffect(() => {
    if (isPending) {
      loaderRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isPending]);

  useEffect(() => {
    if (!pathfindingStatus || pathfindingStatus !== 'success') {
      return;
    }
    // const isPathfindingFailed = pathfindingStatus.error !== '';
    // let formErrorsStatus = checkStdcmConfigErrors(isPathfindingFailed, origin, destination);
    // if (formErrorsStatus?.errorType === StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED) {
    //   formErrorsStatus = {
    //     ...formErrorsStatus,
    //     errorDetails: {
    //       originTime: origin?.arrival
    //         ? t('leaveAt', { time: extractHHMMFromDate(origin.arrival) })
    //         : t('departureTime'),
    //       destinationTime: destination?.arrival
    //         ? t('arriveAt', { time: extractHHMMFromDate(destination.arrival) })
    //         : t('destinationTime'),
    //     },
    //   };s
    //
    // setFormErrors(formErrorsStatus);
  }, [origin, destination, pathfindingStatus]);

  // TODO: DROP STDCMV1: set those values by default in the store when <StdcmAllowances/> is not used anymore.
  useEffect(() => {
    if (!isDebugMode) {
      dispatch(updateGridMarginAfter(35));
      dispatch(updateGridMarginBefore(35));
      dispatch(updateStdcmStandardAllowance({ type: 'time_per_distance', value: 4.5 }));
    }
  }, [isDebugMode]);

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
            <StdcmConsist {...inputsProps} />
          </div>
          <div className="stdcm-v2__separator" />
          <div className="stdcm-v2-simulation-itinerary">
            {/* //TODO: use them when we implement this feature #403 */}
            {/* <StdcmDefaultCard text="Indiquer le sillon antérieur" Icon={<ArrowUp size="lg" />} /> */}
            <StdcmOrigin {...inputsProps} />
            <StdcmVias {...inputsProps} />
            <StdcmDestination {...inputsProps} />
            {/* <StdcmDefaultCard text="Indiquer le sillon postérieur" Icon={<ArrowDown size="lg" />} /> */}
            <div
              className={cx('stdcm-v2-launch-request', {
                'wizz-effect': pathfindingStatus === 'success' || formErrors,
                'pb-5':
                  !!pathfindingStatus &&
                  pathfindingStatus !== 'success' &&
                  showBtnToLaunchSimulation,
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
            {isPending && <StdcmLoader cancelStdcmRequest={cancelStdcmRequest} ref={loaderRef} />}
            {showStatusBanner && <StdcmStatusBanner isFailed={isCalculationFailed} />}
          </div>
        </div>

        <div className="osrd-config-item-container osrd-config-item-container-map stdcm-v2-map">
          <Map
            hideAttribution
            hideItinerary
            preventPointSelection
            pathProperties={pathfindingProperties}
            showStdcmAssets
          />
        </div>
        <div />
      </div>
    </div>
  );
};

export default StdcmConfig;
