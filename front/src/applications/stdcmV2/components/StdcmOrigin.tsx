import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
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

const StdcmOrigin = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const { getStdcmOrigin } = useOsrdConfSelectors() as StdcmConfSelectors;

  const origin = useSelector(getStdcmOrigin);

  const [arrivalScheduleConstraint, setArrivalScheduleConstraint] = useState<ScheduleConstraint>();

  const { updateStdcmPathStep } = useOsrdConfActions() as StdcmConfSliceActions;

  const { originArrival, originToleranceValues } = useMemo(
    () => ({
      originArrival: origin?.arrival ? extractDateAndTimeFromDate(origin.arrival) : undefined,
      originToleranceValues: {
        arrivalToleranceBefore: origin?.arrivalToleranceBefore || 0,
        arrivalToleranceAfter: origin?.arrivalToleranceAfter || 0,
      },
    }),
    [origin]
  );

  const updateOriginPoint = (pathStep: StdcmPathStep) => {
    dispatch(
      updateStdcmPathStep({
        ...pathStep,
        arrival: arrivalScheduleConstraint
          ? generateDatetimeFromDateAndTime(arrivalScheduleConstraint)
          : undefined,
      })
    );
  };

  const onOriginArrivalChange = (schedule: ScheduleConstraint) => {
    setArrivalScheduleConstraint(schedule);
    const newPathStep = { ...origin, arrival: generateDatetimeFromDateAndTime(schedule) };
    dispatch(updateStdcmPathStep(newPathStep));
  };

  const onOriginArrivalTypeChange = (arrivalType: ArrivalTimeTypes) => {
    dispatch(updateStdcmPathStep({ ...origin, arrivalType }));
  };

  const onOriginToleranceChange = ({
    toleranceBefore,
    toleranceAfter,
  }: {
    toleranceBefore: number;
    toleranceAfter: number;
  }) => {
    dispatch(
      updateStdcmPathStep({
        ...origin,
        arrivalToleranceBefore: toleranceBefore,
        arrivalToleranceAfter: toleranceAfter,
      })
    );
  };

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<img src={OriginIcon} alt="origin" className="stdcm-origin-icon" />}
      disabled={disabled}
      hasTip
    >
      <div className="stdcm-v2-origin__parameters">
        <StdcmOperationalPoint
          updatePoint={updateOriginPoint}
          pathStep={origin}
          disabled={disabled}
        />
        <StdcmOpSchedule
          onArrivalChange={onOriginArrivalChange}
          onArrivalTypeChange={onOriginArrivalTypeChange}
          onArrivalToleranceChange={onOriginToleranceChange}
          opTimingData={originArrival}
          opToleranceValues={originToleranceValues}
          opScheduleTimeType={origin.arrivalType || ArrivalTimeTypes.PRECISE_TIME}
          disabled={disabled}
          opId="origin-arrival"
        />
      </div>
    </StdcmCard>
  );
};

export default StdcmOrigin;
