import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type CoreTrackRange,
  type GeoJsonMultiLineString,
} from 'common/api/osrdEditoastApi';
import { MARKER_TYPE, type MarkerInformation } from 'common/Map/components/ItineraryMarkers';
import type { SearchJourneySolution } from 'reducers/searchJourney';
import { getSearchJourneyInfraId } from 'reducers/searchJourney/selectors';
import { useAppDispatch } from 'store';

/** Ordered, deduplicated list of stops: the `to`/`from` of two consecutive segments are
 * merged into a single stop when they reference the same operational point. */
const buildStops = (solution: SearchJourneySolution) => {
  const stops: { opId: string; pointType: MARKER_TYPE }[] = [
    { opId: solution[0].from.op_id, pointType: MARKER_TYPE.ORIGIN },
  ];

  solution.forEach((part, index) => {
    const nextPart = solution[index + 1];
    const isLast = !nextPart;

    stops.push({
      opId: part.to.op_id,
      pointType: isLast ? MARKER_TYPE.DESTINATION : MARKER_TYPE.VIA,
    });

    if (!isLast && nextPart.from.op_id !== part.to.op_id) {
      stops.push({ opId: nextPart.from.op_id, pointType: MARKER_TYPE.VIA });
    }
  });

  return stops;
};

/**
 * For the given solution (an ordered list of train schedule segments), fetches
 * the whole solution's concatenated geometry (for the map), its stop markers
 * (origin/destination/intermediate, merged where two segments share a stop),
 * and each segment's train name (sillon).
 */
export default function useSearchJourneySolutionDetails(solution?: SearchJourneySolution) {
  const infraId = useSelector(getSearchJourneyInfraId);
  const dispatch = useAppDispatch();

  const [geometry, setGeometry] = useState<GeoJsonMultiLineString>();
  const [markers, setMarkers] = useState<MarkerInformation[]>([]);
  const [trainNames, setTrainNames] = useState<Record<number, string>>({});
  const [operationalPointNames, setOperationalPointNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!infraId || !solution || solution.length === 0) {
      setGeometry(undefined);
      setMarkers([]);
      setTrainNames({});
      setOperationalPointNames({});
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const allTrackRanges: CoreTrackRange[] = [];
        const newTrainNames: Record<number, string> = {};

        for (const part of solution) {
          const path = await dispatch(
            osrdEditoastApi.endpoints.getTrainSchedulesByIdPath.initiate(
              {
                id: part.train_schedule_id,
                infraId,
                beginIndex: part.from.path_step_index,
                endIndex: part.to.path_step_index,
              },
              { subscribe: false }
            )
          ).unwrap();

          if (path.status === 'success') {
            allTrackRanges.push(...path.path.track_section_ranges);
          } else if (
            path.failed_status === 'pathfinding_not_found' &&
            path.error_type === 'incompatible_constraints'
          ) {
            allTrackRanges.push(...path.relaxed_constraints_path.path.track_section_ranges);
          }

          if (!(part.train_schedule_id in newTrainNames)) {
            const trainSchedule = await dispatch(
              osrdEditoastApi.endpoints.getTrainSchedulesById.initiate(
                {
                  id: part.train_schedule_id,
                },
                { subscribe: false }
              )
            ).unwrap();
            newTrainNames[part.train_schedule_id] = trainSchedule.train_name;
          }
        }

        let newGeometry: GeoJsonMultiLineString | undefined;
        if (allTrackRanges.length > 0) {
          const pathProperties = await dispatch(
            osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.initiate(
              {
                infraId,
                pathPropertiesInput: { track_section_ranges: allTrackRanges },
              },
              { subscribe: false }
            )
          ).unwrap();
          newGeometry = pathProperties.geometry;
        }

        const stops = buildStops(solution);
        const { related_operational_points: relatedOps } = await dispatch(
          osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.initiate(
            {
              infraId,
              body: {
                operational_point_references: stops.map((stop) => ({
                  type: 'id' as const,
                  operational_point: stop.opId,
                })),
              },
            },
            { subscribe: false }
          )
        ).unwrap();
        const newMarkers: MarkerInformation[] = stops.flatMap((stop, index) => {
          const relatedOp = relatedOps[index];
          if (!relatedOp?.geo) return [];
          return [
            {
              id: relatedOp.id,
              name: relatedOp.name,
              coordinates: relatedOp.geo.coordinates as [number, number],
              pointType: stop.pointType,
              location: {
                type: 'operational_point_part_reference' as const,
                operational_point: { type: 'id' as const, operational_point: stop.opId },
              },
            },
          ];
        });
        const newOperationalPointNames = stops.reduce<Record<string, string>>(
          (names, stop, index) => {
            const relatedOp = relatedOps[index];
            if (relatedOp) names[stop.opId] = relatedOp.name;
            return names;
          },
          {}
        );

        if (!cancelled) {
          setGeometry(newGeometry);
          setMarkers(newMarkers);
          setTrainNames(newTrainNames);
          setOperationalPointNames(newOperationalPointNames);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [infraId, solution, dispatch]);

  return { geometry, markers, trainNames, operationalPointNames, loading, error };
}
