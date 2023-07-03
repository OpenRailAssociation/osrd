import { AllGeoJSON } from '@turf/helpers';
import turfCenter from '@turf/center';
import { AnyAction, Dispatch } from 'redux';
import { SearchOperationalPointResult, SearchSignalResult } from 'common/api/osrdEditoastApi';
import { MapState, Viewport, updateMapSearchMarker } from '../../reducers/map/index';

export const getCoordinates = (
  result: SearchSignalResult | SearchOperationalPointResult,
  map: MapState
) => (map.mapTrackSources === 'schematic' ? result.schematic : result.geographic);

type OnResultSearchClickType = {
  result: SearchSignalResult | SearchOperationalPointResult;
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
  const coordinates = getCoordinates(result, map);

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
