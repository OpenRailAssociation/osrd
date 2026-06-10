import type { PathItemLocation, PostSimilarTrainsApiResponse } from 'common/api/osrdEditoastApi';
import { type MarkerInformation, MARKER_TYPE } from 'common/Map/components/ItineraryMarkers';
import type { StdcmPathStep } from 'reducers/osrdconf/types';

export const getTimesInfoFromDate = (date?: Date | null) =>
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

type ExtractedMarkerInfo = Required<Omit<MarkerInformation, 'metadata'>>;
export const extractMarkersInfo = (pathSteps: StdcmPathStep[]): ExtractedMarkerInfo[] =>
  pathSteps.reduce((acc: ExtractedMarkerInfo[], step, index) => {
    if (!step.operationalPoint) return acc;

    let pointType = MARKER_TYPE.VIA;

    if (index === 0) {
      pointType = MARKER_TYPE.ORIGIN;
    } else if (index === pathSteps.length - 1) {
      pointType = MARKER_TYPE.DESTINATION;
    }

    acc.push({
      id: step.id,
      pointType,
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          main_code: step.operationalPoint.mainCode,
          secondary_code: step.operationalPoint.secondaryCode!,
          type: 'domestic',
          country_code: step.operationalPoint.countryCode,
        },
      },
      coordinates: step.operationalPoint.coordinates,
      name: step.operationalPoint.name,
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

export const stdcmPathStepToPathItemLocation = (
  operationalPoint: StdcmPathStep['operationalPoint']
): PathItemLocation => {
  if (!operationalPoint) {
    throw new Error('Step has no operational point');
  }
  return {
    type: 'operational_point_part_reference',
    operational_point: {
      uic: operationalPoint.uic,
      secondary_code: operationalPoint.secondaryCode,
      type: 'uic',
    },
  };
};
