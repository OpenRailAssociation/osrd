import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

import type {
  OpCh,
  OperationalPointSuggestion,
} from '../Itinerary/ComboBoxCustomList.tsx/ListElementComponent';

const sortChList = (chList: OpCh[]) => {
  const priority: Record<string, number> = { BV: 0, '00': 1 };

  chList.sort((a, b) => {
    const pa = priority[a.code] ?? 99;
    const pb = priority[b.code] ?? 99;

    if (pa !== pb) return pa - pb;
    return a.code.localeCompare(b.code);
  });
};

export const buildOpSuggestion = (
  results: SearchResultItemOperationalPoint[]
): OperationalPointSuggestion[] => {
  const map = new Map<string, OperationalPointSuggestion>();

  for (const r of results) {
    const key = `${r.trigram}||${r.name}`;
    const existing = map.get(key);

    const chEntry = r.ch ? { code: r.ch, opId: r.obj_id } : undefined;

    if (!existing) {
      const chList = chEntry ? [chEntry] : [];
      sortChList(chList);

      map.set(key, {
        id: key,
        trigram: r.trigram,
        name: r.name,
        chList,
      });
    } else if (chEntry && !existing.chList.some((c) => c.code === chEntry.code)) {
      existing.chList.push(chEntry);
      sortChList(existing.chList);
    }
  }

  return [...map.values()];
};
