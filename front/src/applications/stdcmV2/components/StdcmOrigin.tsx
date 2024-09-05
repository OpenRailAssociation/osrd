import { useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
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

const StdcmOrigin = ({
  setCurrentSimulationInputs,
  disabled = false,
  origin,
}: StdcmConfigCardProps & {
  origin: PathStep | null;
}) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const { updateOriginV2, updateOriginArrival, updateOriginArrivalType, updateOriginTolerances } =
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

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      pathSteps: replaceElementAtIndex(prevState?.pathSteps, 0, origin),
      departureDate: originArrival?.arrivalDate,
      departureTime: originArrival?.arrivalTime,
    }));
  }, [origin]);

  const updateOriginV2Point = (pathStep: PathStep | null) => {
    dispatch(updateOriginV2(pathStep));
  };

  const onOriginArrivalChange = (arrival: string) => {
    dispatch(updateOriginArrival(arrival));
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
      title={<img src={OriginIcon} alt="origin" />}
      disabled={disabled}
      hasTip
    >
      <div className="stdcm-v2-origin__parameters">
        <StdcmOperationalPoint
          updatePoint={updateOriginV2Point}
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
      </div>
    </StdcmCard>
  );
};

export default StdcmOrigin;
