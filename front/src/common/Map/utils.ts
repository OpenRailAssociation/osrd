import turfCenter from '@turf/center';
import type { AllGeoJSON } from '@turf/helpers';

import type {
  SearchQuery,
  SearchResultItemOperationalPoint,
  SearchResultItemSignal,
} from 'common/api/osrdEditoastApi';

export const getCoordinates = (result: SearchResultItemSignal | SearchResultItemOperationalPoint) =>
  result.geographic;

export const computeCoordinatesOnClick = (
  result: SearchResultItemSignal | SearchResultItemOperationalPoint
) => {
  const coordinates = getCoordinates(result);
  const center = turfCenter(coordinates as AllGeoJSON);
  return center.geometry.coordinates;
};

/** This function will build a query based on the type of __searchState__.
 * If it can be converted to a number, the op search will be based on its code rather than its name. */
export function createMapSearchQuery(
  searchState: string,
  { codeColumn, nameColumn }: { codeColumn: string; nameColumn: string }
): SearchQuery {
  return !Number.isNaN(Number(searchState))
    ? ['=', [codeColumn], Number(searchState)]
    : ['search', [nameColumn], searchState];
}

export function createTrackSystemQuery(trackSystem: string) {
  if (trackSystem === 'TVM') {
    return [
      'or',
      ['contains', ['list', 'TVM300'], ['signaling_systems']],
      ['contains', ['list', 'TVM430'], ['signaling_systems']],
    ];
  }
  return ['contains', ['list', trackSystem], ['signaling_systems']];
}
