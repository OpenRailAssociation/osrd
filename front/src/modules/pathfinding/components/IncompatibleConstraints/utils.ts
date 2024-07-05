import { featureCollection, type FeatureCollection } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';
import type { LineString } from 'geojson';
import { sortedUniq, uniq } from 'lodash';
import type { IconType } from 'react-icons';
import { FaTrafficLight } from 'react-icons/fa6';
import { MdFlashOn } from 'react-icons/md';
import { TbBuildingTunnel } from 'react-icons/tb';

import type { IncompatibleConstraintItemEnhanced } from './type';

export function getIcon(type: string): IconType {
  let result = MdFlashOn;
  switch (type) {
    case 'incompatible_electrification_ranges':
      result = MdFlashOn;
      break;
    case 'incompatible_gauge_ranges':
      result = TbBuildingTunnel;
      break;
    case 'incompatible_signalisation_system_ranges':
      result = FaTrafficLight;
      break;
    default:
      result = MdFlashOn;
  }
  return result;
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
  constraints: Array<IncompatibleConstraintItemEnhanced>
): FeatureCollection<LineString, { ids: string[]; types: string[] }> {
  const points = sortedUniq(constraints.map((e) => [e.start, e.end]).flat());
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
  console.log(constraints, segmentsWithConstraintIds);
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
