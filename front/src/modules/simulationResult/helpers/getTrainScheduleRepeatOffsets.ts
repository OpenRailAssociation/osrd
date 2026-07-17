import type { TrainSpaceTimeData, BaseTrainProjection } from 'modules/simulationResult/types';
import { Duration } from 'utils/duration';

/**
 * A relative time range.
 *
 * end is an exclusive bound.
 */
export type TimeRange = {
  start: Duration;
  end: Duration;
};

function getProjectionTravelTime(curves: BaseTrainProjection['spaceTimeCurves']): Duration {
  const times = curves.flatMap((curve) => curve.times);
  return new Duration({ milliseconds: Math.max(...times) - Math.min(...times) });
}

/**
 * Compute a list of time offsets a train schedule needs to be repeated on to
 * fill a time range.
 *
 * This helper can be used to repeat a paced train related pattern within the
 * space time chart (curves, occupancy blocks, and so on) for hourly
 * timetables.
 *
 * The caller is expected to repeat the train schedule once per returned array
 * element, shifting the train schedule by the time offset each time.
 */
export default function getTrainScheduleRepeatOffsets(
  trainSchedule: Pick<TrainSpaceTimeData, 'paced' | 'spaceTimeCurves'>,
  range: TimeRange
): Duration[] {
  if (!trainSchedule.paced) {
    return [Duration.zero];
  }

  let maxTravelTime = getProjectionTravelTime(trainSchedule.spaceTimeCurves);
  for (const exceptionProjection of trainSchedule.paced.exceptionProjections.values()) {
    const travelTime = getProjectionTravelTime(exceptionProjection.spaceTimeCurves);
    if (travelTime > maxTravelTime) {
      maxTravelTime = travelTime;
    }
  }

  // Expand the range on the left side to ensure an occurrence starting before
  // but arriving after range.start is visible
  const effectiveRangeStart = range.start.sub(maxTravelTime);

  const timeWindow = trainSchedule.paced.timeWindow;
  const repeatStartIndex = Math.floor(effectiveRangeStart.ms / timeWindow.ms);
  const repeatEndIndex = Math.ceil(range.end.ms / timeWindow.ms);

  const offsets: Duration[] = [];
  for (let i = repeatStartIndex; i < repeatEndIndex; i++) {
    offsets.push(new Duration({ milliseconds: i * timeWindow.ms }));
  }

  return offsets;
}
