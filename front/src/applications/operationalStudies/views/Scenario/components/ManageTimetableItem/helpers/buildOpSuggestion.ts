import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

import type { OperationalPointSuggestion } from '../Itinerary/ComboBoxCustomList.tsx/ListElementComponent';

export const buildOpSuggestion = (
  results: SearchResultItemOperationalPoint[]
): OperationalPointSuggestion[] => {
  const map = new Map<string, OperationalPointSuggestion>();

  for (const r of results) {
    const key = `${r.trigram}||${r.name}`;

    const existing = map.get(key);

    const chEntry = r.ch ? { code: r.ch, opId: r.obj_id } : undefined;

    if (!existing) {
      map.set(key, {
        id: key,
        trigram: r.trigram,
        name: r.name,
        chList: chEntry ? [chEntry] : [],
      });
    } else if (chEntry && !existing.chList.some((c) => c.code === chEntry.code)) {
      existing.chList.push(chEntry);
    }
  }

  return [...map.values()];
};
