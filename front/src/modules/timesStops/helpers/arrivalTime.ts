/* eslint-disable import/prefer-default-export */
import { dateToHHMMSS } from 'utils/date';
import { Duration, addDurationToDate } from 'utils/duration';
import { calculateTimeDifferenceInDays } from 'utils/timeManipulation';

import type { ScheduleEntry, TimeExtraDays } from '../types';

const computeDayTimeFromStartTime = (
  startDatetime: Date,
  duration: Duration,
  previousDatetime: Date
): { timeExtraDay: TimeExtraDays; previousTime: Date } => {
  const arrivalDatetime = addDurationToDate(startDatetime, duration);

  const isAfterMidnight = arrivalDatetime.getDate() !== previousDatetime.getDate();

  const timeExtraDay = {
    time: dateToHHMMSS(arrivalDatetime),
    daySinceDeparture: calculateTimeDifferenceInDays(startDatetime, arrivalDatetime),
    dayDisplayed: isAfterMidnight,
  };

  return { timeExtraDay, previousTime: arrivalDatetime };
};

export const computeInputDatetimes = (
  startDatetime: Date,
  lastReferenceDate: Date,
  schedule: ScheduleEntry | undefined,
  { isDeparture }: { isDeparture: boolean }
) => {
  let theoreticalArrival: Date | undefined;
  let arrival: TimeExtraDays | undefined;
  let departure: TimeExtraDays | undefined;
  let refDate = lastReferenceDate;

  let arrivalDuration;
  // if is departure, use the startDatetime
  if (isDeparture) {
    arrivalDuration = Duration.zero;
  } else if (schedule?.arrival) {
    arrivalDuration = Duration.parse(schedule.arrival); // duration from startTime
  }

  if (arrivalDuration) {
    theoreticalArrival = addDurationToDate(startDatetime, arrivalDuration);
    const { timeExtraDay, previousTime } = computeDayTimeFromStartTime(
      startDatetime,
      arrivalDuration,
      refDate
    );
    arrival = timeExtraDay;
    refDate = previousTime;

    if (schedule?.stop_for) {
      const stopFor = Duration.parse(schedule.stop_for);
      const resultDeparture = computeDayTimeFromStartTime(
        startDatetime,
        arrivalDuration.add(stopFor),
        refDate
      );
      departure = resultDeparture.timeExtraDay;
      refDate = resultDeparture.previousTime;
    }
  }

  return { theoreticalArrival, arrival, departure, refDate };
};
