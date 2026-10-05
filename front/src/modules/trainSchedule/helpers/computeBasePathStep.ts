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
  const { key, location } = trainSchedule.path[pathItemIndex];
  const correspondingSchedule = trainSchedule.schedule?.find((schedule) => schedule.at === key);

  const {
    arrival,
    stop_for: stopFor,
    reception_signal: receptionSignal,
  } = correspondingSchedule || {};

  let name;
  if (location.type === 'operational_point_part_reference') {
    if (location.operational_point.type === 'domestic') {
      name =
        location.operational_point.main_code +
        (location.operational_point.secondary_code
          ? `/${location.operational_point.secondary_code}`
          : '');
    } else if (location.operational_point.type === 'uic') {
      name = location.operational_point.uic.toString();
    } else if (location.operational_point.type === 'id') {
      name = location.operational_point.operational_point;
    }
  }

  let theoreticalMargin;
  if (trainSchedule.margins && pathItemIndex !== trainSchedule.path.length - 1) {
    theoreticalMargin = findCorrespondingMargin(key, pathItemIndex, trainSchedule.margins);
  }

  return {
    id: key,
    name,
    location,
    arrival: arrival ? Duration.parse(arrival) : null,
    stopFor: stopFor ? Duration.parse(stopFor) : null,
    // If not provided, we set receptionSignal to its default value
    // in order to avoid unwanted exceptions (when not provided, editoast returns it
    // with its default value)
    receptionSignal: receptionSignal ?? 'OPEN',
    theoreticalMargin,
  };
};

export default computeBasePathStep;
