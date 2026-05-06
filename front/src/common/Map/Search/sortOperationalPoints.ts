import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

/** Sort two operational points alphabetically first by name, then by secondary code (prioritizing passenger station) */
const sortOperationalPointsByNameAndSecondaryCode = (
  a: SearchResultItemOperationalPoint,
  b: SearchResultItemOperationalPoint
) => {
  const nameComparison = a.name.localeCompare(b.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  const secondaryCodeA = a.secondary_code ?? '';
  const secondaryCodeB = b.secondary_code ?? '';

  if (a.is_passenger_station) {
    return -1;
  }
  if (b.is_passenger_station) {
    return 1;
  }
  return secondaryCodeA.localeCompare(secondaryCodeB);
};

/** Sort two operational points alphabetically first by main code, then by name, then by secondary code (prioritizing passenger station) */
export const sortOperationalPointsFromMainCodeSearch = (
  a: SearchResultItemOperationalPoint,
  b: SearchResultItemOperationalPoint
) => {
  const mainCodeComparison = a.main_code.localeCompare(b.main_code);
  if (mainCodeComparison !== 0) {
    return mainCodeComparison;
  }

  return sortOperationalPointsByNameAndSecondaryCode(a, b);
};

/** Sort two operational points prioritizing those starting with the search query, then alphabetically using name and secondary code */
export const sortOperationalPointsFromNameAndUicSearch =
  (searchQuery: string) =>
  (a: SearchResultItemOperationalPoint, b: SearchResultItemOperationalPoint) => {
    const lowerCaseSearchTerm = searchQuery.toLowerCase();
    const aStartsWithSearchTerm = a.name.toLowerCase().startsWith(lowerCaseSearchTerm);
    const bStartsWithSearchTerm = b.name.toLowerCase().startsWith(lowerCaseSearchTerm);

    if (aStartsWithSearchTerm && !bStartsWithSearchTerm) {
      return -1;
    }
    if (!aStartsWithSearchTerm && bStartsWithSearchTerm) {
      return 1;
    }

    return sortOperationalPointsByNameAndSecondaryCode(a, b);
  };
