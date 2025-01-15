import {
  MARKER_TYPE,
  type MarkerInformation,
} from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/ItineraryMarkers';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { dateToHHMMSS, dateToDDMMYYYY } from 'utils/date';

export const getTimesInfoFromDate = (date?: Date) =>
  date
    ? {
        date,
        arrivalDate: dateToDDMMYYYY(date), // ISO date part
        arrivalTime: dateToHHMMSS(date, { withoutSeconds: true }),
        arrivalTimeHours: date.getHours(),
        arrivalTimeMinutes: date.getMinutes(),
      }
    : undefined;

export const extractMarkersInfo = (pathSteps: StdcmPathStep[]): MarkerInformation[] =>
  pathSteps.reduce((acc: MarkerInformation[], step, index) => {
    if (!step.location) return acc;

    let pointType = MARKER_TYPE.VIA;

    if (index === 0) {
      pointType = MARKER_TYPE.ORIGIN;
    } else if (index === pathSteps.length - 1) {
      pointType = MARKER_TYPE.DESTINATION;
    }

    acc.push({
      pointType,
      uic: step.location.uic,
      secondary_code: step.location.secondary_code,
      coordinates: step.location.coordinates,
      name: step.location.name,
    });

    return acc;
  }, []);
