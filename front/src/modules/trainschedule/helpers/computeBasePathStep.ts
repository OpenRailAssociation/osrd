import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import { mmToM } from 'utils/physics';

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
 * Given a timetable item and a path item index, aggregate schedule, margins and the corresponding path item to return a PathStep
 */
const computeBasePathStep = (
  timetableItem: Pick<TrainScheduleBase, 'path' | 'schedule' | 'margins'>,
  pathItemIndex: number
): PathStep => {
  const step = timetableItem.path[pathItemIndex];
  const correspondingSchedule = timetableItem.schedule?.find((schedule) => schedule.at === step.id);

  const {
    arrival,
    stop_for: stopFor,
    locked,
    reception_signal: receptionSignal,
  } = correspondingSchedule || {};

  let name;
  if ('trigram' in step) {
    name = step.trigram + (step.secondary_code ? `/${step.secondary_code}` : '');
  } else if ('uic' in step) {
    name = step.uic.toString();
  } else if ('operational_point' in step) {
    name = step.operational_point;
  }

  let theoreticalMargin;
  if (timetableItem.margins && pathItemIndex !== timetableItem.path.length - 1) {
    theoreticalMargin = findCorrespondingMargin(step.id, pathItemIndex, timetableItem.margins);
  }

  return {
    ...step,
    ...('track' in step ? { offset: mmToM(step.offset) } : null),
    name,
    arrival: arrival ? Duration.parse(arrival) : null,
    stopFor: stopFor ? Duration.parse(stopFor) : null,
    locked,
    receptionSignal,
    theoreticalMargin,
  };
};

export default computeBasePathStep;
