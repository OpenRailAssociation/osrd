import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';

import type {
  OpSecondaryCode,
  OperationalPointSuggestion,
} from '../Itinerary/ComboBoxCustomList/ListElementComponent';

const sortSecondaryCodeList = (secondaryCodeList: OpSecondaryCode[]) => {
  const priority: Record<string, number> = { BV: 0, '00': 1 };

  secondaryCodeList.sort((a, b) => {
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
    const key = `${r.main_code}||${r.name}`;
    const existing = map.get(key);

    if (!existing) {
      const secondaryCodeList = r.secondary_code
        ? [{ code: r.secondary_code, opId: r.obj_id }]
        : [];

      map.set(key, {
        id: key,
        mainCode: r.main_code,
        uic: r.uic,
        name: r.name,
        secondaryCodeList,
      });
    } else if (
      r.secondary_code &&
      !existing.secondaryCodeList.some((c) => c.code === r.secondary_code)
    ) {
      existing.secondaryCodeList.push({ code: r.secondary_code, opId: r.obj_id });
    }
  }

  for (const suggestion of map.values()) {
    sortSecondaryCodeList(suggestion.secondaryCodeList);
  }

  return [...map.values()];
};
