import type {
  PathItemLocation,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

export const findOpFromPathItem = (
  pathItem: PathItemLocation,
  searchResults: SearchResultItemOperationalPoint[]
) =>
  searchResults.find((searchResult) => {
    if ('uic' in pathItem) {
      return searchResult.uic === pathItem.uic && searchResult.ch === pathItem.secondary_code;
    }
    if ('trigram' in pathItem) {
      return (
        searchResult.trigram === pathItem.trigram && searchResult.ch === pathItem.secondary_code
      );
    }
    if ('operational_point' in pathItem) {
      return searchResult.obj_id === pathItem.operational_point;
    }
    return false;
  });

export const addDurationToDate = (date: Date, duration: string) =>
  new Date(date.getTime() + ISO8601Duration2sec(duration) * 1000);
