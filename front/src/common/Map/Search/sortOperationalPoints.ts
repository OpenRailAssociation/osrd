import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

import { MAIN_OP_CH_CODES } from './consts';

/** Sort two operational points alphabetically first by name, then by ch (prioritizing main ch) */
const sortOperationalPointsByNameAndCh = (
  a: SearchResultItemOperationalPoint,
  b: SearchResultItemOperationalPoint
) => {
  const nameComparison = a.name.localeCompare(b.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  const chA = a.ch ?? '';
  const chB = b.ch ?? '';

  if (MAIN_OP_CH_CODES.includes(chA)) {
    return -1;
  }
  if (MAIN_OP_CH_CODES.includes(chB)) {
    return 1;
  }
  return chA.localeCompare(chB);
};

/** Sort two operational points alphabetically first by trigram, then by name, then by ch (prioritizing main ch) */
export const sortOperationalPointsFromTrigramSearch = (
  a: SearchResultItemOperationalPoint,
  b: SearchResultItemOperationalPoint
) => {
  const trigramComparison = a.trigram.localeCompare(b.trigram);
  if (trigramComparison !== 0) {
    return trigramComparison;
  }

  return sortOperationalPointsByNameAndCh(a, b);
};

/** Sort two operational points prioritizing those starting with the search query, then alphabetically using name and ch */
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

    return sortOperationalPointsByNameAndCh(a, b);
  };
