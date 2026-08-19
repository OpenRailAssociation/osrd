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

/**
 * Compute the list of time offsets a periodic item needs to be repeated on to
 * fill a time range.
 *
 * maxItemDuration expands the range on the left side, so that occurrences
 * starting before but ending after range.start stay visible.
 */
export function getTimetableRepeatOffsets({
  period,
  maxItemDuration,
  range,
}: {
  period: Duration;
  maxItemDuration: Duration;
  range: TimeRange;
}): Duration[] {
  const repeatStartIndex = Math.floor(range.start.sub(maxItemDuration).ms / period.ms);
  const repeatEndIndex = Math.ceil(range.end.ms / period.ms);

  const offsets: Duration[] = [];
  for (let i = repeatStartIndex; i < repeatEndIndex; i++) {
    offsets.push(new Duration({ milliseconds: i * period.ms }));
  }
  return offsets;
}

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

  return getTimetableRepeatOffsets({
    period: trainSchedule.paced.timeWindow,
    maxItemDuration: maxTravelTime,
    range,
  });
}
