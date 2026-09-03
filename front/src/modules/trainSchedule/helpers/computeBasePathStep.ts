import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

const findCorrespondingMargin = (
  stepId: string,
  stepIndex: number,
  margins: { boundaries: string[]; values: string[] }
) => {
  // The first pathStep will never have its id in boundaries
  if (stepIndex === 0) return margins.values[0] === 'none' ? undefined : margins.values[0];

  const marginIndex = margins.boundaries.findIndex((boundaryId) => boundaryId === stepId);

  return marginIndex !== -1 ? margins.values[marginIndex + 1] : undefined;
};

/**
 * Given a train schedule and a path item index, aggregate schedule, margins and the corresponding path item to return a PathStep
 */
const computeBasePathStep = (
  trainSchedule: Pick<TrainSchedule, 'path' | 'schedule' | 'margins'>,
  pathItemIndex: number
): PathStep => {
  const { id, location } = trainSchedule.path[pathItemIndex];
  const correspondingSchedule = trainSchedule.schedule?.find((schedule) => schedule.at === id);

  const {
    arrival,
    stop_for: stopFor,
    reception_signal: receptionSignal,
  } = correspondingSchedule || {};

  let theoreticalMargin;
  if (trainSchedule.margins && pathItemIndex !== trainSchedule.path.length - 1) {
    theoreticalMargin = findCorrespondingMargin(id, pathItemIndex, trainSchedule.margins);
  }

  return {
    id,
    location,
    arrival: arrival ? Duration.parse(arrival) : null,
    stopFor: stopFor ? Duration.parse(stopFor) : null,
    // If not provided, we set receptionSignal to its default value
    // in order to avoid unwanted exceptions (when not provided, editoast returns it
    // with its default value)
    receptionSignal: receptionSignal ?? 'OPEN',
    theoreticalMargin: theoreticalMargin ?? null,
  };
};

export default computeBasePathStep;
