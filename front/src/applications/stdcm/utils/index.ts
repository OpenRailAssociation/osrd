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
        reference: {
          trigram: step.location.reference.trigram,
          secondary_code: step.location.reference.secondary_code,
        },
      },
      coordinates: step.location.coordinates,
      name: step.location.name,
    });

    return acc;
  }, []);

/**
 * Merges segments from multiple API calls, prioritizing earlier calls (more precise).
 * Then compresses successive segments with the same train name.
 */
export const mergeSimilarTrainSegments = (
  segmentsWithAllConstraints: PostSimilarTrainsApiResponse['similar_trains'],
  segmentsWithSpeedLimitTagConstraint: PostSimilarTrainsApiResponse['similar_trains'] | null,
  segmentsWithRsNameConstraint: PostSimilarTrainsApiResponse['similar_trains'] | null
): PostSimilarTrainsApiResponse['similar_trains'] => {
  // All arrays have the same length because they represent the same route segments,
  // just with different constraint combinations applied during the API calls

  const result: PostSimilarTrainsApiResponse['similar_trains'] = [];

  for (let i = 0; i < segmentsWithAllConstraints.length; i++) {
    const baseSegment = segmentsWithAllConstraints[i];
    const segment = { ...baseSegment };

    // Priority: all constraints > speed limit tag > rolling stock name > null
    if (segment.train === null) {
      // Find matching segment in segmentsWithSpeedLimitTagConstraint
      const matchingSpeedLimit = segmentsWithSpeedLimitTagConstraint?.find(
        (s) => s.begin === baseSegment.begin && s.end === baseSegment.end
      );

      if (matchingSpeedLimit && matchingSpeedLimit?.train !== null) {
        segment.train = matchingSpeedLimit.train;
      } else {
        // Find matching segment in segmentsWithRsNameConstraint
        const matchingRsName = segmentsWithRsNameConstraint?.find(
          (s) => s.begin === baseSegment.begin && s.end === baseSegment.end
        );

        if (matchingRsName && matchingRsName?.train !== null) {
          segment.train = matchingRsName.train;
        }
      }
    }

    const last = result[result.length - 1];
    const lastTrain = last?.train?.train_name ?? null;
    const currentTrain = segment.train?.train_name ?? null;

    // Merge adjacent segments with the same train
    if (last && last.end === segment.begin && lastTrain === currentTrain) {
      last.end = segment.end;
    } else {
      result.push(segment);
    }
  }

  return result;
};
