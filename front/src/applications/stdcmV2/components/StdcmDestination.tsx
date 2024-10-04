import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import DestinationIcon from 'assets/pictures/stdcmV2/destination.svg';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { extractDateAndTimeFromDate, generateDatetimeFromDateAndTime } from 'utils/date';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { ArrivalTimeTypes, type ScheduleConstraint, type StdcmConfigCardProps } from '../types';
import { useSelector } from 'react-redux';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';

const StdcmDestination = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getStdcmDestination } = useOsrdConfSelectors() as StdcmConfSelectors;

  const destination = useSelector(getStdcmDestination);

  const [arrivalScheduleConstraint, setArrivalScheduleConstraint] = useState<ScheduleConstraint>();

  const { updateStdcmPathStep } =
    useOsrdConfActions() as StdcmConfSliceActions;

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

  const updateDestinationPoint = (pathStep: StdcmPathStep) => {
    const newPathStep = {
      ...pathStep,
      arrival: arrivalScheduleConstraint
        ? generateDatetimeFromDateAndTime(arrivalScheduleConstraint)
        : undefined,
    };
    dispatch(
      updateStdcmPathStep(newPathStep)
    );
  };

  const onDestinationArrivalChange = (schedule: ScheduleConstraint) => {
    setArrivalScheduleConstraint(schedule);
    const newPathStep = { ...destination, arrival: generateDatetimeFromDateAndTime(schedule) };
    dispatch(updateStdcmPathStep(newPathStep));
  };

  const onDestinationArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateStdcmPathStep({ ...destination, arrivalType }));
  };

  const onDestinationToleranceChange = ({
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
    >
      <div className="stdcm-v2-destination">
        <StdcmOperationalPoint
          updatePoint={updateDestinationPoint}
          pathStep={destination}
          disabled={disabled}
        />
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
      </div>
    </StdcmCard>
  );
};

export default StdcmDestination;
