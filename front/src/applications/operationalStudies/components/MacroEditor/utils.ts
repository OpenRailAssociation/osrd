import type {
  PathItemLocation,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';
import { ISO8601Duration2sec } from 'utils/timeManipulation';

export const findOpFromPathItem = (
  pathItem: PathItemLocation,
  searchResults: SearchResultItemOperationalPoint[]
) => {
  // When a path item doesn't specify a secondary code, mimick what editoast
  // does: pick 'BV', '00' or an OP without a ch.
  let chs: (string | null)[] = [];
  if ('uic' in pathItem || 'trigram' in pathItem) {
    if (pathItem.secondary_code) {
      chs = [pathItem.secondary_code];
    } else {
      chs = ['BV', '00', null];
    }
  }

  return searchResults.find((searchResult) => {
    if ('uic' in pathItem) {
      return searchResult.uic === pathItem.uic && chs.includes(searchResult.ch);
    }
    if ('trigram' in pathItem) {
      return searchResult.trigram === pathItem.trigram && chs.includes(searchResult.ch);
    }
    if ('operational_point' in pathItem) {
      return searchResult.obj_id === pathItem.operational_point;
    }
    return false;
  });
};

export const addDurationToDate = (date: Date, duration: string) =>
  new Date(date.getTime() + ISO8601Duration2sec(duration) * 1000);
