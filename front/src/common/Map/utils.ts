import turfCenter from '@turf/center';
import { updateMapSearchMarker } from 'reducers/map/index';
import type { AllGeoJSON } from '@turf/helpers';
import type { AnyAction, Dispatch } from 'redux';
import type { MapState, Viewport } from 'reducers/map/index';
import type {
  SearchQuery,
  SearchResultItemOperationalPoint,
  SearchResultItemSignal,
} from 'common/api/osrdEditoastApi';

export const getCoordinates = (result: SearchResultItemSignal | SearchResultItemOperationalPoint) =>
  result.geographic;

type OnResultSearchClickType = {
  result: SearchResultItemSignal | SearchResultItemOperationalPoint;
  map: MapState;
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  dispatch: Dispatch<AnyAction>;
  setSearch?: React.Dispatch<React.SetStateAction<string>>;
  title: string;
};

export const onResultSearchClick = ({
  result,
  map,
  updateExtViewport,
  dispatch,
  setSearch,
  title,
}: OnResultSearchClickType) => {
  if (setSearch) setSearch(title);
  const coordinates = getCoordinates(result);

  const center = turfCenter(coordinates as AllGeoJSON);

  const newViewport = {
    ...map.viewport,
    longitude: center.geometry.coordinates[0],
    latitude: center.geometry.coordinates[1],
    zoom: 16,
  };
  updateExtViewport(newViewport);
  dispatch(
    updateMapSearchMarker({
      title,
      lonlat: center.geometry.coordinates,
    })
  );
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
