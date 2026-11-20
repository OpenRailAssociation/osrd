import type {
  PathItemLocation,
  SearchResultItemMacroNode,
  SearchResultItemOperationalPoint,
} from 'common/api/osrdEditoastApi';

import type {
  OpSecondaryCode,
  OperationalPointSuggestion,
} from '../Itinerary/ComboBoxCustomList/ListElementComponent';
import { getOpKey } from '../Itinerary/utils';

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

type OpCodes = Pick<OperationalPointSuggestion, 'countryCode' | 'mainCode'>;

export const hasSameCodes = (a: OpCodes, b: OpCodes) =>
  a.countryCode === b.countryCode && a.mainCode === b.mainCode;

export const buildCustomOpSuggestion = (
  name: string,
  location: PathItemLocation,
  existingOp: OperationalPointSuggestion | null = null
): OperationalPointSuggestion => {
  const opRef = location.type === 'track_offset' ? null : location.operational_point;

  let mainCode = location.type === 'track_offset' ? location.track : '';

  if (opRef?.type === 'domestic') mainCode = opRef.main_code;
  if (opRef?.type === 'uic') mainCode = opRef.uic.toString();
  if (opRef?.type === 'id') mainCode = opRef.operational_point;

  const secondaryCode = opRef && opRef.type !== 'id' ? (opRef.secondary_code ?? null) : null;
  const secondaryCodeList = existingOp?.secondaryCodeList ?? [];
  const key =
    location.type === 'track_offset' ? `${location.track}-${location.offset}` : getOpKey(location);
  const id =
    opRef?.type === 'domestic'
      ? buildOperationalPointSuggestionId(opRef.country_code, opRef.main_code)
      : `custom-${key}`;

  return {
    id: existingOp?.id ?? id,
    name: name || mainCode,
    mainCode,
    countryCode: opRef?.type === 'domestic' ? opRef.country_code : '',
    secondaryCodeList:
      existingOp && secondaryCode === null
        ? secondaryCodeList
        : [...secondaryCodeList, { code: secondaryCode, name: null, isPending: true }],
    source: existingOp?.source ?? 'pending',
    location: opRef?.type === 'domestic' ? undefined : location,
  };
};

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
  if (node.node_location.type !== 'operational_point_reference') return null;
  const opRef = node.node_location.operational_point;
  if (opRef.type !== 'domestic') return null;

  return {
    id: `macroNode:${node.id}`,
    name: node.full_name ?? node.short_name ?? '',
    mainCode: opRef.main_code,
    countryCode: opRef.country_code,
    secondaryCodeList: [{ code: opRef.secondary_code ?? null, name: null }],
    source: 'macroNode',
  };
};
