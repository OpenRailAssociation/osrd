import { useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import StdcmOpSchedule from './StdcmOpSchedule';
import { ArrivalTimeTypes, type ScheduleConstraint, type StdcmConfigCardProps } from '../types';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import { extractDateAndTimeFromDate, generateDatetimeFromDateAndTime } from 'utils/date';

const StdcmOrigin = ({ disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const { getStdcmOrigin } = useOsrdConfSelectors() as StdcmConfSelectors;

  const origin = useSelector(getStdcmOrigin);

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

  const updateLocation = (newLocation: StdcmPathStep['location']) => {
    dispatch(
      updateStdcmPathStep({
        ...origin,
        location: newLocation,
      })
    );
  };

  const onOriginArrivalChange = (schedule: ScheduleConstraint) => {
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

  useEffect(() => console.log('origin', origin), [origin]);

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<img src={OriginIcon} alt="origin" className="stdcm-origin-icon" />}
      className="extremity"
      disabled={disabled}
      hasTip
    >
      {(!origin.location || 'uic' in origin.location) && (
        <StdcmOperationalPoint
          updatePathStepLocation={updateLocation}
          pathStepId={origin.id}
          pathStepLocation={origin.location}
          disabled={disabled}
        />
      )}
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
    </StdcmCard>
  );
};

export default StdcmOrigin;
