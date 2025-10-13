import {
  type MarkerInformation,
  MARKER_TYPE,
} from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/ManageTimetableItemMap/ItineraryMarkers';
import type { PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
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

// Compresses successive segments with the same retained train name
export const mergeSimilarTrainSegments = (
  trains: PostSimilarTrainsApiResponse['similar_trains']
): PostSimilarTrainsApiResponse['similar_trains'] =>
  trains.reduce<PostSimilarTrainsApiResponse['similar_trains']>((acc, segment) => {
    if (acc.length > 0) {
      const lastSegment = acc[acc.length - 1];

      const lastTrainName = lastSegment.train?.train_name ?? null;
      const currentTrainName = segment.train?.train_name ?? null;

      if (lastTrainName === currentTrainName) {
        lastSegment.end = segment.end;
      } else {
        acc.push({
          begin: segment.begin,
          end: segment.end,
          train: segment.train,
        });
      }
    } else {
      acc.push({
        begin: segment.begin,
        end: segment.end,
        train: segment.train,
      });
    }

    return acc;
  }, []);
