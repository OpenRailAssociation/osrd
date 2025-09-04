import {
  type MarkerInformation,
  MARKER_TYPE,
} from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/ManageTimetableItemMap/ItineraryMarkers';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

export const getTimesInfoFromDate = (date?: Date) =>
  date
    ? {
        date,
        arrivalDate: date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
        }),
        arrivalTime: date.toLocaleString(undefined, { timeStyle: 'short' }),
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
      location: {
        uic: step.location.uic,
        secondary_code: step.location.secondary_code,
      },
      coordinates: step.location.coordinates,
      name: step.location.name,
    });

    return acc;
  }, []);
