import { useMemo } from 'react';

import { useSelector } from 'react-redux';

import { isSimulated } from 'applications/operationalStudies/utils';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { getIsSimulationEnabled } from 'reducers/simulationResults/selectors';

import type { TrainSpaceTimeData } from '../../types';

type UseHandleInvalidProjectionsProps = {
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  projections: TrainSpaceTimeData[];
};

/**
 * Hook that enriches train projections with invalid status.
 * Marks trains with invalid simulations or 'scheduleNotHonored' as invalid
 * for proper styling in the UI.
 */
const useHandleInvalidProjections = ({
  trainSchedulesWithDetails,
  projections,
}: UseHandleInvalidProjectionsProps): TrainSpaceTimeData[] => {
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);

  return useMemo(() => {
    if (!isSimulationEnabled) return projections;

    // Create a map for quick lookup of train schedules by id
    const timetableMap = new Map(trainSchedulesWithDetails.map((train) => [train.id, train]));

    return projections.map((projection) => {
      const trainSchedule = timetableMap.get(projection.id);
      if (!trainSchedule) return projection;

      const updatedProjection = { ...projection, isSimulated: isSimulated(trainSchedule.summary) };

      if (trainSchedule.paced?.exceptions && projection.paced?.exceptionProjections) {
        const updatedExceptions = new Map(projection.paced.exceptionProjections);

        trainSchedule.paced.exceptions.forEach((exception) => {
          // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
          const existingException = updatedExceptions.get(exception.id!);
          if (existingException) {
            // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
            updatedExceptions.set(exception.id!, {
              ...existingException,
              isSimulated: isSimulated(exception.summary),
            });
          }
        });

        updatedProjection.paced = {
          ...projection.paced,
          exceptionProjections: updatedExceptions,
        };
      }

      return updatedProjection;
    });
  }, [isSimulationEnabled, trainSchedulesWithDetails, projections]);
};

export default useHandleInvalidProjections;
