import type {
  PathItemLocation,
  SearchResultItemMacroNode,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';

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
        countryCode: r.country_code,
        secondaryCodeList,
        source: 'infra',
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

export const buildMacroNodeSuggestion = (
  results: SearchResultItemMacroNode[]
): OperationalPointSuggestion[] =>
  results.map((node): OperationalPointSuggestion => {
    const suggestion: OperationalPointSuggestion = {
      id: `macroNode:${node.id}`,
      name: node.full_name ?? node.short_name ?? '',
      mainCode: node.short_name ?? '',
      countryCode: '',
      secondaryCodeList: [],
      source: 'macroNode',
    };

    if (node.node_location.type === 'track_offset') {
      const { track, offset } = node.node_location;
      return { ...suggestion, location: { type: 'track_offset', track, offset } };
    }

    const opRef = node.node_location.operational_point;
    const location: PathItemLocation = {
      type: 'operational_point_part_reference',
      operational_point: opRef,
    };

    switch (opRef.type) {
      case 'domestic':
        return {
          ...suggestion,
          location,
          mainCode: opRef.main_code,
          countryCode: opRef.country_code,
          secondaryCodeList: opRef.secondary_code ? [{ code: opRef.secondary_code }] : [],
        };
      case 'uic':
        return {
          ...suggestion,
          location,
          uic: opRef.uic,
          secondaryCodeList: opRef.secondary_code ? [{ code: opRef.secondary_code }] : [],
        };
      default:
        return { ...suggestion, location };
    }
  });
