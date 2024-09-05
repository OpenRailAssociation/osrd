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
import { extractHHMM } from 'utils/date';

import StdcmConsist from './StdcmConsist';
import StdcmDestination from './StdcmDestination';
import StdcmLoader from './StdcmLoader';
import StdcmOrigin from './StdcmOrigin';
import StdcmStatusBanner from './StdcmStatusBanner';
import StdcmVias from './StdcmVias';
import StdcmWarningBox from './StdcmWarningBox';
import { ArrivalTimeTypes, StdcmConfigErrorTypes } from '../types';
import type { StdcmConfigErrors, StdcmSimulation, StdcmSimulationInputs } from '../types';
import checkStdcmConfigErrors from '../utils/checkStdcmConfigErrors';

/**
 * Inputs in different cards inside the StdcmConfig component come from the stdcm redux store.
 * CurrentSimulationInputs is the current simulation inputs which are not yet launched.
 * SelectedSimulation is the simulation that is currently selected from the list of simulations.
 */
type StdcmConfigProps = {
  currentSimulationInputs?: StdcmSimulationInputs;
  selectedSimulation?: StdcmSimulation;
  pathProperties?: ManageTrainSchedulePathProperties;
  isPending: boolean;
  retainedSimulationIndex: number;
  showBtnToLaunchSimulation: boolean;
  showStatusBanner: boolean;
  isCalculationFailed: boolean;
  launchStdcmRequest: () => Promise<void>;
  cancelStdcmRequest: () => void;
  setCurrentSimulationInputs: React.Dispatch<React.SetStateAction<StdcmSimulationInputs>>;
};

const StdcmConfig = ({
  selectedSimulation,
  pathProperties,
  isPending,
  retainedSimulationIndex,
  showBtnToLaunchSimulation,
  showStatusBanner,
  isCalculationFailed,
  launchStdcmRequest,
  cancelStdcmRequest,
  setCurrentSimulationInputs,
}: StdcmConfigProps) => {
  const { t } = useTranslation('stdcm');
  const loaderRef = useRef<HTMLDivElement>(null);

  const dispatch = useAppDispatch();
  const {
    updateGridMarginAfter,
    updateGridMarginBefore,
    updateStdcmStandardAllowance,
    updateOriginArrivalType,
    updateDestinationArrivalType,
  } = useOsrdConfActions() as StdcmConfSliceActions;

  const { getOrigin, getDestination } = useOsrdConfSelectors();
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);

  const { pathfindingState } = usePathfinding(undefined, pathProperties);

  const [formErrors, setFormErrors] = useState<StdcmConfigErrors | undefined>(undefined);

  const inputsProps = {
    disabled: isPending || retainedSimulationIndex > -1,
    selectedSimulation,
    setCurrentSimulationInputs,
  };

  const startSimulation = () => {
    if (pathfindingState.done && !formErrors) {
      launchStdcmRequest();
    }
  };

  const removeOriginArrivalTime = () => {
    dispatch(updateOriginArrivalType(ArrivalTimeTypes.ASAP));
  };
  const removeDestinationArrivalTime = () => {
    dispatch(updateDestinationArrivalType(ArrivalTimeTypes.ASAP));
  };

  useEffect(() => {
    if (isPending) {
      loaderRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isPending]);

  useEffect(() => {
    const isPathfindingFailed = pathfindingState.error !== '';
    let formErrorsStatus = checkStdcmConfigErrors(isPathfindingFailed, origin, destination);
    if (formErrorsStatus?.errorType === StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED) {
      formErrorsStatus = {
        ...formErrorsStatus,
        errorDetails: {
          originTime: origin?.arrival
            ? t('leaveAt', { time: extractHHMM(origin.arrival) })
            : t('departureTime'),
          destinationTime: destination?.arrival
            ? t('arriveAt', { time: extractHHMM(destination.arrival) })
            : t('destinationTime'),
        },
      };
    }
    setFormErrors(formErrorsStatus);
  }, [origin, destination, pathfindingState.error]);

  // TODO: DROP STDCMV1: set those values by default in the store when <StdcmAllowances/> is not used anymore.
  useEffect(() => {
    dispatch(updateGridMarginAfter(35));
    dispatch(updateGridMarginBefore(35));
    dispatch(updateStdcmStandardAllowance({ type: 'time_per_distance', value: 4.5 }));
  }, []);

  return (
    <div className="stdcm-v2__body">
      <div className="stdcm-v2-simulation-settings">
        <div className="stdcm-v2-consist-container">
          <StdcmConsist {...inputsProps} />
        </div>
        <div className="stdcm-v2__separator" />
        <div className="stdcm-v2-simulation-itinerary">
          {/* //TODO: use them when we implement this feature #403 */}
          {/* <StdcmDefaultCard text="Indiquer le sillon antérieur" Icon={<ArrowUp size="lg" />} /> */}
          <StdcmOrigin {...inputsProps} origin={origin} />
          <StdcmVias {...inputsProps} />
          <StdcmDestination {...inputsProps} destination={destination} />
          {/* <StdcmDefaultCard text="Indiquer le sillon postérieur" Icon={<ArrowDown size="lg" />} /> */}
          <div
            className={cx('stdcm-v2-launch-request', {
              'wizz-effect': !pathfindingState.done || formErrors,
              'pb-5': !pathfindingState.error,
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
        <Map hideAttribution hideItinerary preventPointSelection pathProperties={pathProperties} />
      </div>
      <div />
    </div>
  );
};

export default StdcmConfig;
