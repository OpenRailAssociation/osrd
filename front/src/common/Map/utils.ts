import { MapState } from '../../reducers/map/index';
import { ISignalSearchResult } from './Search/searchTypes';

const getCoordinates = (result: ISignalSearchResult, map: MapState) =>
  map.mapTrackSources === 'schematic' ? result.schematic : result.geographic;

export default getCoordinates;
