import { Zap, Gauge, Question, Signals } from '@osrd-project/ui-icons';
import { featureCollection, type FeatureCollection } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';
import type { LineString } from 'geojson';
import { sortBy, uniq } from 'lodash';

import type {
  FiltersConstrainstState,
  IncompatibleConstraintEnhanced,
  IncompatibleConstraintType,
} from './types';

export function getIcon(type: IncompatibleConstraintType) {
  switch (type) {
    case 'incompatible_electrification_ranges':
      return Zap;
    case 'incompatible_gauge_ranges':
      return Gauge;
    case 'incompatible_signaling_system_ranges':
      return Signals;
    default:
      return Question;
  }
}

/**
 * Build a segmented Geojson of the constraints.
 * Each segment has one or many constraints, and never overlaps.
 *
 * @param line The geojson linestring on which constraints are applied
 * @param constraints List of constraints
 */
export function getSegmentsConstraints(
  line: LineString,
  constraints: Array<IncompatibleConstraintEnhanced>
): FeatureCollection<LineString, { ids: string[]; types: string[] }> {
  const points = uniq(sortBy(constraints.map((e) => [e.start, e.end]).flat()));
  const segmentsWithConstraintIds = points.reduce(
    (acc, curr, index) => {
      if (index < points.length - 1) {
        const nextPoint = points[index + 1];
        const constraintsIncluded = constraints.filter(
          (c) => (curr < c.end && nextPoint > c.start) || (curr === c.start && nextPoint === c.end)
        );
        if (constraintsIncluded.length > 0)
          acc.push({
            start: curr,
            end: nextPoint,
            ids: constraintsIncluded.map((c) => c.id),
            types: uniq(constraintsIncluded.map((c) => c.type)),
          });
      }
      return acc;
    },
    [] as Array<{ start: number; end: number; ids: string[]; types: string[] }>
  );
  return featureCollection(
    segmentsWithConstraintIds.map((e) => ({
      ...lineSliceAlong(line, e.start, e.end, {
        units: 'millimeters',
      }),
      properties: {
        ids: e.ids,
        types: e.types,
      },
    }))
  );
}

export function getSizeOfEnabledFilters(filters: FiltersConstrainstState) {
  return Object.values(filters).filter((value) => value.enabled === true).length;
}
