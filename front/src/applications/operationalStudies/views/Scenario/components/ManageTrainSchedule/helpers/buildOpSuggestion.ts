import type {
  PathItemLocation,
  SearchResultItemMacroNode,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';

import type {
  OpSecondaryCode,
  OperationalPointSuggestion,
} from '../Itinerary/ComboBoxCustomList/ListElementComponent';
import type { DomesticOperationalPointReference } from '../types';

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

export const buildCustomOpSuggestion = (
  name: string,
  opRef: DomesticOperationalPointReference
): OperationalPointSuggestion => ({
  id: `${opRef.country_code}-${opRef.main_code}`,
  name,
  mainCode: opRef.main_code,
  countryCode: opRef.country_code,
  secondaryCodeList: [{ code: opRef.secondary_code ?? null }],
  source: 'custom',
});

export const buildOpSuggestion = (
  results: SearchResultItemOperationalPoint[]
): OperationalPointSuggestion[] => {
  const map = new Map<string, OperationalPointSuggestion>();

  for (const r of results) {
    const key = `${r.main_code}||${r.name}`;
    const existing = map.get(key);
    const secondaryCode = r.secondary_code ?? null;

    if (!existing) {
      const secondaryCodeList = [{ code: secondaryCode }];

      map.set(key, {
        id: key,
        mainCode: r.main_code,
        uic: r.uic,
        name: r.name,
        countryCode: r.country_code,
        secondaryCodeList,
        source: 'infra',
      });
    } else if (!existing.secondaryCodeList.some((c) => c.code === secondaryCode)) {
      existing.secondaryCodeList.push({ code: secondaryCode });
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
      secondaryCodeList: [{ code: null }],
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
          secondaryCodeList: [{ code: opRef.secondary_code ?? null }],
        };
      case 'uic':
        return {
          ...suggestion,
          location,
          uic: opRef.uic,
          secondaryCodeList: [{ code: opRef.secondary_code ?? null }],
        };
      default:
        return { ...suggestion, location };
    }
  });
