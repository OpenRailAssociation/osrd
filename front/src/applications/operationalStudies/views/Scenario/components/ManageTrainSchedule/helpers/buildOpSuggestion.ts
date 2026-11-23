import type {
  SearchResultItemMacroNode,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';

import type {
  OpSecondaryCode,
  OperationalPointSuggestion,
} from '../Itinerary/ComboBoxCustomList/ListElementComponent';

const sortSecondaryCodeList = (secondaryCodeList: OpSecondaryCode[]) => {
  const priority: Record<string, number> = { BV: 0, '00': 1 };

  // BV and 00 first, then other codes alphabetically, then the op without secondary code
  const getPriority = (code: string | null) => (code === null ? 100 : (priority[code] ?? 99));

  secondaryCodeList.sort((a, b) => {
    const pa = getPriority(a.code);
    const pb = getPriority(b.code);

    if (pa !== pb) return pa - pb;
    return (a.code ?? '').localeCompare(b.code ?? '');
  });
};

export const buildOperationalPointSuggestionId = (countryCode: string, mainCode: string) =>
  `${countryCode}-${mainCode}`;

export const buildOpSuggestion = (
  results: SearchResultItemOperationalPoint[]
): OperationalPointSuggestion[] => {
  const map = new Map<string, OperationalPointSuggestion>();

  for (const r of results) {
    const key = buildOperationalPointSuggestionId(r.country_code, r.main_code);
    const existing = map.get(key);
    const secondaryCode = r.secondary_code ?? null;
    const secondaryEntry: OpSecondaryCode = { code: secondaryCode, name: r.secondary_name ?? null };

    if (!existing) {
      map.set(key, {
        id: key,
        mainCode: r.main_code,
        uic: r.uic,
        name: r.name,
        countryCode: r.country_code,
        secondaryCodeList: [secondaryEntry],
        source: 'infra',
      });
    } else if (!existing.secondaryCodeList.some((c) => c.code === secondaryCode)) {
      existing.secondaryCodeList.push(secondaryEntry);
    }
  }

  for (const suggestion of map.values()) {
    sortSecondaryCodeList(suggestion.secondaryCodeList);
  }

  return [...map.values()];
};

export const buildMacroNodeSuggestion = (
  node: SearchResultItemMacroNode
): OperationalPointSuggestion | null => {
  // TODO: also suggest macro nodes with a non-domestic or a track offset location
  if (node.node_location.type !== 'operational_point_reference') return null;
  const opRef = node.node_location.operational_point;
  if (opRef.type !== 'domestic') return null;

  return {
    id: buildOperationalPointSuggestionId(opRef.country_code, opRef.main_code),
    name: node.full_name ?? node.short_name ?? '',
    mainCode: opRef.main_code,
    countryCode: opRef.country_code,
    secondaryCodeList: [{ code: opRef.secondary_code ?? null, name: null }],
    source: 'macroNode',
  };
};
