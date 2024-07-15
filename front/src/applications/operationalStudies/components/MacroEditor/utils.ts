import type {
  PathItemLocation,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';

// eslint-disable-next-line import/prefer-default-export
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
