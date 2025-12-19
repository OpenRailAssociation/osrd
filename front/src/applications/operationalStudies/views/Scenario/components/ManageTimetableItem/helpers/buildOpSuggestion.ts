import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

import type { OperationalPointSuggestion } from '../Itinerary/ComboBoxCustomList.tsx/ListElementComponent';

export const buildOpSuggestion = (
  results: SearchResultItemOperationalPoint[]
): OperationalPointSuggestion[] => {
  const map = new Map<string, OperationalPointSuggestion>();

  for (const r of results) {
    const key = `${r.trigram}__${r.name}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: key, // ou `${r.trigram}-${r.name}` (doit être stable)
        trigram: r.trigram,
        name: r.name,
        chList: [{ code: r.ch }],
      });
      continue;
    }
  }

  return [...map.values()];
};
