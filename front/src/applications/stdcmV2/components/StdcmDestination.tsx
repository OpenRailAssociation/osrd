import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import DestinationIcon from 'assets/pictures/stdcmV2/destination.svg';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { ArrivalTimeTypes, type ScheduleConstraint, type StdcmConfigCardProps } from '../types';
import { useSelector } from 'react-redux';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import { extractDateAndTimeFromDate, generateDatetimeFromDateAndTime } from 'utils/date';

const StdcmDestination = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getStdcmDestination } = useOsrdConfSelectors() as StdcmConfSelectors;

  const destination = useSelector(getStdcmDestination);

  const { updateStdcmPathStep } = useOsrdConfActions() as StdcmConfSliceActions;

  const { destinationArrival, destinationToleranceValues } = useMemo(
    () => ({
      destinationArrival: destination?.arrival
        ? extractDateAndTimeFromDate(destination.arrival)
        : undefined,
      destinationToleranceValues: {
        arrivalToleranceBefore: destination?.arrivalToleranceBefore || 0,
        arrivalToleranceAfter: destination?.arrivalToleranceAfter || 0,
      },
    }),
    [destination]
  );

  const updateLocation = (newLocation: StdcmPathStep['location']) => {
    dispatch(
      updateStdcmPathStep({
        ...destination,
        location: newLocation,
      })
    );
  };

  const onArrivalChange = (schedule: ScheduleConstraint) => {
    const newPathStep = { ...destination, arrival: generateDatetimeFromDateAndTime(schedule) };
    dispatch(updateStdcmPathStep(newPathStep));
  };

  const onArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateStdcmPathStep({ ...destination, arrivalType }));
  };

  const onToleranceChange = ({
    toleranceBefore,
    toleranceAfter,
  }: {
    toleranceBefore: number;
    toleranceAfter: number;
  }) => {
    dispatch(
      updateStdcmPathStep({
        ...destination,
        arrivalToleranceBefore: toleranceBefore,
        arrivalToleranceAfter: toleranceAfter,
      })
    );
  };

  return (
    <StdcmCard
      name={t('trainPath.destination')}
      title={<img src={DestinationIcon} alt="destination" className="stdcm-destination-icon" />}
      disabled={disabled}
      className="extremity"
    >
      {(!destination.location || 'uic' in destination.location) && (
        <StdcmOperationalPoint
          updatePathStepLocation={updateLocation}
          pathStepId={destination.id}
          pathStepLocation={destination.location}
          disabled={disabled}
        />
      )}

      <StdcmOpSchedule
        onArrivalChange={onArrivalChange}
        onArrivalTypeChange={onArrivalTypeChange}
        onArrivalToleranceChange={onToleranceChange}
        opTimingData={destinationArrival}
        opToleranceValues={destinationToleranceValues}
        opScheduleTimeType={destination?.arrivalType || ArrivalTimeTypes.ASAP}
        disabled={disabled}
        opId="destination-arrival"
      />
    </StdcmCard>
  );
};

export default StdcmDestination;
