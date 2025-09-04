import type { TrainSchedule } from 'common/api/osrdEditoastApi';
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
  timetableItem: Pick<TrainSchedule, 'path' | 'schedule' | 'margins'>,
  pathItemIndex: number
): PathStep => {
  const { id, deleted, ...location } = timetableItem.path[pathItemIndex];
  const correspondingSchedule = timetableItem.schedule?.find((schedule) => schedule.at === id);

  const {
    arrival,
    stop_for: stopFor,
    locked,
    reception_signal: receptionSignal,
  } = correspondingSchedule || {};

  let name;
  if ('trigram' in location) {
    name = location.trigram + (location.secondary_code ? `/${location.secondary_code}` : '');
  } else if ('uic' in location) {
    name = location.uic.toString();
  } else if ('operational_point' in location) {
    name = location.operational_point;
  }

  let theoreticalMargin;
  if (timetableItem.margins && pathItemIndex !== timetableItem.path.length - 1) {
    theoreticalMargin = findCorrespondingMargin(id, pathItemIndex, timetableItem.margins);
  }

  return {
    id,
    deleted,
    name,

    location: { ...location, ...('track' in location ? { offset: mmToM(location.offset) } : null) },
    arrival: arrival ? Duration.parse(arrival) : null,
    stopFor: stopFor ? Duration.parse(stopFor) : null,
    // If not provided, we set locked and receptionSignal to their default values
    // in order to avoid unwanted exceptions (when not provided, editoast returns them
    // with their default values)
    locked: locked ?? false,
    receptionSignal: receptionSignal ?? 'OPEN',
    theoreticalMargin,
  };
};

export default computeBasePathStep;
