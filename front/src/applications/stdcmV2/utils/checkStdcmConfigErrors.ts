import type { PathStep } from 'reducers/osrdconf/types';

import { StdcmConfigErrorTypes, ArrivalTimeTypes, type StdcmConfigErrors } from '../types';

const checkStdcmConfigErrors = (
  pathfindingStateError: boolean,
  origin: PathStep | null,
  destination: PathStep | null
): StdcmConfigErrors | undefined => {
  const isOneOpPointMissing = !origin || !destination;
  if (isOneOpPointMissing) {
    return undefined;
  }

  if (pathfindingStateError) {
    return { errorType: StdcmConfigErrorTypes.PATHFINDING_FAILED };
  }

  const areBothPointsASAP =
    origin.arrivalType === ArrivalTimeTypes.ASAP &&
    destination.arrivalType === ArrivalTimeTypes.ASAP;

  if (areBothPointsASAP) {
    return { errorType: StdcmConfigErrorTypes.NO_SCHEDULED_POINT };
  }

  const areBothPointsScheduled =
    origin.arrivalType === ArrivalTimeTypes.PRECISE_TIME &&
    destination.arrivalType === ArrivalTimeTypes.PRECISE_TIME;

  if (areBothPointsScheduled) {
    return {
      errorType: StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED,
    };
  }

  const isOnePointScheduledWithoutTime =
    (origin.arrivalType === ArrivalTimeTypes.PRECISE_TIME && !origin.arrival) ||
    (destination.arrivalType === ArrivalTimeTypes.PRECISE_TIME && !destination.arrival);

  if (isOnePointScheduledWithoutTime) {
    return { errorType: StdcmConfigErrorTypes.NO_SCHEDULED_POINT };
  }
  return undefined;
};

export default checkStdcmConfigErrors;
