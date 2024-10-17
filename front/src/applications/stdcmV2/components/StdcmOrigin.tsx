import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { extractDateAndTimefromISO, generateISODateFromDateTime } from 'utils/date';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { ArrivalTimeTypes, type ScheduleConstraint, type StdcmConfigCardProps } from '../types';

const StdcmOrigin = ({
  disabled = false,
  origin,
}: StdcmConfigCardProps & {
  origin: PathStep | null;
}) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const [arrivalScheduleConstraint, setArrivalScheduleConstraint] = useState<ScheduleConstraint>();

  const { updateOrigin, updateOriginArrival, updateOriginArrivalType, updateOriginTolerances } =
    useOsrdConfActions() as StdcmConfSliceActions;

  const { originArrival, originToleranceValues } = useMemo(
    () => ({
      originArrival: origin?.arrival ? extractDateAndTimefromISO(origin.arrival) : undefined,
      originToleranceValues: {
        arrivalToleranceBefore: origin?.arrivalToleranceBefore || 0,
        arrivalToleranceAfter: origin?.arrivalToleranceAfter || 0,
      },
    }),
    [origin]
  );

  const updateOriginPoint = (pathStep: PathStep | null) => {
    if (!pathStep || !arrivalScheduleConstraint) {
      dispatch(updateOrigin(pathStep));
    } else {
      dispatch(
        updateOrigin({
          ...pathStep,
          arrival: generateISODateFromDateTime(arrivalScheduleConstraint),
        })
      );
    }
  };

  const onOriginArrivalChange = (schedule: ScheduleConstraint) => {
    setArrivalScheduleConstraint(schedule);

    const newOpArrival = generateISODateFromDateTime(schedule);
    dispatch(updateOriginArrival(newOpArrival));
  };

  const onOriginArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateOriginArrivalType(arrivalType));
  };

  const onOriginToleranceChange = ({
    toleranceBefore,
    toleranceAfter,
  }: {
    toleranceBefore: number;
    toleranceAfter: number;
  }) => {
    dispatch(updateOriginTolerances({ toleranceBefore, toleranceAfter }));
  };

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<img src={OriginIcon} alt="origin" className="stdcm-origin-icon" />}
      className="extremity"
      disabled={disabled}
      hasTip
    >
      <StdcmOperationalPoint
        updatePoint={updateOriginPoint}
        point={origin}
        opPointId={origin?.id || 'origin'}
        disabled={disabled}
      />
      {origin && (
        <StdcmOpSchedule
          onArrivalChange={onOriginArrivalChange}
          onArrivalTypeChange={onOriginArrivalTypeChange}
          onArrivalToleranceChange={onOriginToleranceChange}
          opTimingData={originArrival}
          opToleranceValues={originToleranceValues}
          opScheduleTimeType={origin?.arrivalType || ArrivalTimeTypes.PRECISE_TIME}
          disabled={disabled}
          opId="origin-arrival"
        />
      )}
    </StdcmCard>
  );
};

export default StdcmOrigin;
