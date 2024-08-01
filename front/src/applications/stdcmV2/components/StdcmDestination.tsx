import React, { useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import DestinationIcon from 'assets/pictures/stdcmV2/destination.svg';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { replaceElementAtIndex } from 'utils/array';
import { extractDateAndTimefromISO } from 'utils/date';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { ArrivalTimeTypes, type StdcmConfigCardProps } from '../types';

const StdcmDestination = ({
  setCurrentSimulationInputs,
  disabled = false,
  destination,
}: StdcmConfigCardProps & {
  destination: PathStep | null;
}) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const {
    updateDestinationV2,
    updateDestinationArrival,
    updateDestinationArrivalType,
    updateDestinationTolerances,
  } = useOsrdConfActions() as StdcmConfSliceActions;

  const { destinationArrival, destinationToleranceValues } = useMemo(
    () => ({
      destinationArrival: destination?.arrival
        ? extractDateAndTimefromISO(destination.arrival)
        : undefined,
      destinationToleranceValues: {
        arrivalToleranceBefore: destination?.arrivalToleranceBefore || 0,
        arrivalToleranceAfter: destination?.arrivalToleranceAfter || 0,
      },
    }),
    [destination]
  );

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      pathSteps: replaceElementAtIndex(
        prevState?.pathSteps,
        prevState?.pathSteps.length - 1,
        destination
      ),
      destination,
      destinationTime: destinationArrival?.arrivalTime,
    }));
  }, [destination]);

  const updateDestinationPoint = (pathStep: PathStep | null) => {
    dispatch(updateDestinationV2(pathStep));
  };

  const onDestinationArrivalChange = (arrival: string) => {
    dispatch(updateDestinationArrival(arrival));
  };

  const onDestinationArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateDestinationArrivalType(arrivalType));
  };

  const onDestinationToleranceChange = ({
    toleranceBefore,
    toleranceAfter,
  }: {
    toleranceBefore: number;
    toleranceAfter: number;
  }) => {
    dispatch(updateDestinationTolerances({ toleranceBefore, toleranceAfter }));
  };

  return (
    <StdcmCard
      name={t('trainPath.destination')}
      title={<img src={DestinationIcon} alt="destination" />}
      disabled={disabled}
    >
      <div className="stdcm-v2-destination">
        <StdcmOperationalPoint
          updatePoint={updateDestinationPoint}
          point={destination}
          opPointId={destination?.id || 'destination'}
          disabled={disabled}
        />
        {destination && (
          <StdcmOpSchedule
            onArrivalChange={onDestinationArrivalChange}
            onArrivalTypeChange={onDestinationArrivalTypeChange}
            onArrivalToleranceChange={onDestinationToleranceChange}
            opTimingData={destinationArrival}
            opToleranceValues={destinationToleranceValues}
            opScheduleTimeType={destination?.arrivalType || ArrivalTimeTypes.ASAP}
            disabled={disabled}
            opId="destination-arrival"
          />
        )}
      </div>
    </StdcmCard>
  );
};

export default StdcmDestination;
