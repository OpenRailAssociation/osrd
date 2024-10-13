import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import DestinationIcon from 'assets/pictures/stdcm/destination.svg';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { extractDateAndTimefromISO, generateISODateFromDateTime } from 'utils/date';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { DEFAULT_TOLERANCE } from '../../consts';
import { ArrivalTimeTypes, type ScheduleConstraint, type StdcmConfigCardProps } from '../../types';

const StdcmDestination = ({
  disabled = false,
  destination,
}: StdcmConfigCardProps & {
  destination: PathStep | null;
}) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const [arrivalScheduleConstraint, setArrivalScheduleConstraint] = useState<ScheduleConstraint>();

  const {
    updateDestination,
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
        arrivalToleranceBefore: destination?.arrivalToleranceBefore || DEFAULT_TOLERANCE,
        arrivalToleranceAfter: destination?.arrivalToleranceAfter || DEFAULT_TOLERANCE,
      },
    }),
    [destination]
  );

  const updateDestinationPoint = (pathStep: PathStep | null) => {
    if (!pathStep || !arrivalScheduleConstraint) {
      dispatch(updateDestination(pathStep));
    } else {
      dispatch(
        updateDestination({
          ...pathStep,
          arrival: generateISODateFromDateTime(arrivalScheduleConstraint),
        })
      );
    }
  };

  const onDestinationArrivalChange = (schedule: ScheduleConstraint) => {
    setArrivalScheduleConstraint(schedule);

    const newOpArrival = generateISODateFromDateTime(schedule);
    dispatch(updateDestinationArrival(newOpArrival));
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
      title={<img src={DestinationIcon} alt="destination" className="stdcm-destination-icon" />}
      disabled={disabled}
      className="extremity"
    >
      <div className="stdcm-destination">
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
