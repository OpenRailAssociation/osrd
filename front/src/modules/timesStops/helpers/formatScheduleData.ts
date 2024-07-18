import { ISO8601Duration2sec, datetime2sec, secToHoursString } from 'utils/timeManipulation';

import type { ScheduleEntry } from '../types';

function formatScheduleData(schedule: ScheduleEntry, startTime: string) {
  if (!schedule) {
    return { arrival: '', departure: '', stopFor: '' };
  }
  const startTimeSeconds = datetime2sec(new Date(startTime));
  const arrivalSeconds = schedule.arrival ? ISO8601Duration2sec(schedule.arrival) : '';
  const stopForSeconds = schedule.stop_for ? ISO8601Duration2sec(schedule.stop_for) : '';
  const departure =
    arrivalSeconds && stopForSeconds
      ? secToHoursString(startTimeSeconds + arrivalSeconds + stopForSeconds, true)
      : '';
  return {
    arrival: arrivalSeconds ? secToHoursString(startTimeSeconds + arrivalSeconds, true) : '',
    departure,
    stopFor: String(stopForSeconds),
  };
}

export default formatScheduleData;
