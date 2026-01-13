import { useCallback, useEffect, useState } from 'react';

import { osrdEditoastApi, type SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useDebounce } from 'utils/helpers';

import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTimetableItem/Itinerary/ComboBoxCustomList.tsx/ListElementComponent';

type Params = {
  infraId?: number;
  buildOpSuggestion: (res: SearchResultItemOperationalPoint[]) => OperationalPointSuggestion[];
  pageSize?: number;
  minChars?: number;
  debounceMs?: number;
};

// Query helpers
const splitTokens = (raw: string) =>
  raw
    .trim()
    .split(/[\s/-]+/)
    .filter(Boolean);

const norm = (s: string) => s.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
const toUpper = (s: string) => s.trim().toUpperCase();

const normalizePhrase = (value: string) =>
  value
    .normalize('NFD')
    .toLowerCase()
    .split('-')
    .join(' ')
    .split(' ')
    .filter(Boolean)
    .join(' ')
    .trim();

const tokenClause = (token: string) => [
  'or',
  ['=', ['trigram'], toUpper(token)],
  ['search', ['name'], token],
  ['search', ['trigram'], token],
  ['search', ['ch'], token],
];

const buildMultiTokenQuery = (tokens: string[]) => ['and', ...tokens.map(tokenClause)];

const uniqById = (items: OperationalPointSuggestion[]) => {
  const seen = new Set<string>();
  const uniqueSuggestions: OperationalPointSuggestion[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    uniqueSuggestions.push(it);
  }
  return uniqueSuggestions;
};

// Secondary code helpers //
const chStarts = (s: OperationalPointSuggestion, tokenUpper: string) =>
  s.chList.some((ch) => toUpper(ch.code).startsWith(tokenUpper));
const chIncludes = (s: OperationalPointSuggestion, tokenUpper: string) =>
  s.chList.some((ch) => toUpper(ch.code).includes(tokenUpper));

const inferUniqueChFromInput = (suggestion: OperationalPointSuggestion, rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length < 2) return undefined;

  const last = toUpper(tokens[tokens.length - 1]);
  const allCodes = Array.from(new Set(suggestion.chList.map((c) => toUpper(c.code))));

  if (!last) return undefined;

  const exact = allCodes.filter((code) => code === last);
  if (exact.length === 1) return exact[0];

  const pref = allCodes.filter((code) => code.startsWith(last));
  if (pref.length === 1) return pref[0];

  return undefined;
};

const hasChPrefix = (s: OperationalPointSuggestion, chTokenUpper: string) =>
  s.chList.some((ch) => toUpper(ch.code).startsWith(chTokenUpper));

const tokenMatchesIncludesNoCh = (s: OperationalPointSuggestion, token: string) => {
  const tokenNormalized = norm(token);
  const tokenUpper = toUpper(token);
  return norm(s.name).includes(tokenNormalized) || toUpper(s.trigram).includes(tokenUpper);
};

const tokenMatchesStartNoCh = (s: OperationalPointSuggestion, token: string) => {
  const tokenNormalized = norm(token);
  const tokenUpper = toUpper(token);
  return norm(s.name).startsWith(tokenNormalized) || toUpper(s.trigram).startsWith(tokenUpper);
};

// Secondary code only for last token
const lastTokenMatchesIncludes = (s: OperationalPointSuggestion, lastToken: string) =>
  tokenMatchesIncludesNoCh(s, lastToken) || chIncludes(s, toUpper(lastToken));

const lastTokenMatchesStarts = (s: OperationalPointSuggestion, lastToken: string) =>
  tokenMatchesStartNoCh(s, lastToken) || chStarts(s, toUpper(lastToken));

// Trigram helpers //
const shouldKeepTrigramLock = (s: OperationalPointSuggestion, tokens: string[]) => {
  if (tokens.length <= 1) return true;

  const nameNorm = normalizePhrase(s.name);

  const lastToken = tokens[tokens.length - 1] ?? '';
  const lastTokenUpper = toUpper(lastToken);

  const restText = tokens
    .filter((_, i) => i > 0)
    .join(' ')
    .trim();

  const beforeLastText = tokens
    .filter((_, i) => i > 0 && i < tokens.length - 1)
    .join(' ')
    .trim();

  const lastIsChForThisSuggestion =
    lastTokenUpper.length >= 2 && lastTokenUpper.length <= 3 && hasChPrefix(s, lastTokenUpper);

  if (lastIsChForThisSuggestion) {
    if (!beforeLastText) return true;
    const beforeNorm = normalizePhrase(beforeLastText);
    return nameNorm === beforeNorm || nameNorm.startsWith(beforeNorm);
  }

  const restNorm = normalizePhrase(restText);
  return nameNorm === restNorm || nameNorm.startsWith(restNorm);
};

const sortOneWord = (suggestions: OperationalPointSuggestion[], tokenRaw: string) => {
  const tokenNormalized = norm(tokenRaw);
  const tokenUpper = toUpper(tokenRaw);

  const nameExact = suggestions.filter((s) => norm(s.name) === tokenNormalized);
  if (nameExact.length) return nameExact; // exact name matches first and is unique suggestion

  const trigramExact = suggestions.filter((s) => toUpper(s.trigram) === tokenUpper);

  const trigramStarts = suggestions.filter((s) => toUpper(s.trigram).startsWith(tokenUpper));
  const nameStarts = suggestions.filter((s) => norm(s.name).startsWith(tokenNormalized));
  const trigramIncludes = suggestions.filter((s) => toUpper(s.trigram).includes(tokenUpper));
  const nameIncludes = suggestions.filter((s) => norm(s.name).includes(tokenNormalized));
  const chPrefixMatches = suggestions.filter((s) => chStarts(s, tokenUpper));
  const chSubstringMatches = suggestions.filter((s) => chIncludes(s, tokenUpper));

  return uniqById([
    ...trigramExact,
    ...trigramStarts,
    ...nameStarts,
    ...trigramIncludes,
    ...nameIncludes,
    ...chPrefixMatches,
    ...chSubstringMatches,
  ]);
};

const sortMultiTokens = (suggestions: OperationalPointSuggestion[], raw: string) => {
  const tokens = splitTokens(raw);
  if (tokens.length < 2) return [];

  const lastToken = tokens[tokens.length - 1];
  const baseTokens = tokens.slice(0, -1);

  const fullPhrase = norm(tokens.join(' '));
  const basePhrase = norm(baseTokens.join(' '));
  const lastTokenUpper = toUpper(lastToken);

  const firstTokenUpper = toUpper(tokens[0] ?? '');

  // 0) strict lock
  const strictMatches = suggestions.filter(
    (s) =>
      baseTokens.every((t) => tokenMatchesIncludesNoCh(s, t)) &&
      lastTokenMatchesIncludes(s, lastToken)
  );

  // base for further sorting
  const sortingBase = strictMatches.length ? strictMatches : suggestions;

  const rankedSuggestions: OperationalPointSuggestion[] = [];
  const appendSuggestions = (items: OperationalPointSuggestion[]) => {
    rankedSuggestions.push(...items);
  };

  if (firstTokenUpper) {
    const trigramExactPinned = suggestions
      .filter((s) => toUpper(s.trigram) === firstTokenUpper)
      .filter((s) => shouldKeepTrigramLock(s, tokens));
    appendSuggestions(trigramExactPinned);
  }

  // 1) full query
  appendSuggestions(sortingBase.filter((s) => norm(s.name).startsWith(fullPhrase)));
  appendSuggestions(sortingBase.filter((s) => norm(s.name).includes(fullPhrase)));

  // 2) baseStarts + ch prefix on last token
  const nameStartsWithBasePhrase = sortingBase.filter((s) => norm(s.name).startsWith(basePhrase));
  if (nameStartsWithBasePhrase.length) {
    const chPrefixMatchesOnLastToken = nameStartsWithBasePhrase.filter((s) =>
      chStarts(s, lastTokenUpper)
    );
    appendSuggestions(chPrefixMatchesOnLastToken);
    appendSuggestions(nameStartsWithBasePhrase);
  }

  const nameIncludesBasePhrase = sortingBase.filter((s) => norm(s.name).includes(basePhrase));
  if (nameIncludesBasePhrase.length) {
    const chPrefixMatchesOnLastToken = nameIncludesBasePhrase.filter((s) =>
      chStarts(s, lastTokenUpper)
    );
    appendSuggestions(chPrefixMatchesOnLastToken);
    appendSuggestions(nameIncludesBasePhrase);
  }

  // 3) allStarts
  const allTokensStartMatch = sortingBase.filter(
    (s) =>
      baseTokens.every((t) => tokenMatchesStartNoCh(s, t)) && lastTokenMatchesStarts(s, lastToken)
  );
  appendSuggestions(allTokensStartMatch);

  // 4) fallback locked
  appendSuggestions(strictMatches);

  return uniqById(rankedSuggestions);
};

// sorting helpers //
const sortSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) return sortOneWord(suggestions, tokens[0]);
  return sortMultiTokens(suggestions, rawInput);
};

// nothing typed / one word: all candidates, no best suggestion
// if last token doesn't match any CH prefix in any suggestion => all candidates
// candidates are those whose CH startsWith(lastToken), others grey; if none => all grey
const markSuggestions = (suggestions: OperationalPointSuggestion[], rawInput: string) => {
  const tokens = splitTokens(rawInput);
  if (tokens.length <= 1) {
    return suggestions.map((s) => ({
      ...s,
      chList: s.chList.map((ch) => ({ ...ch, isCandidate: true, isBestSuggestion: false })),
    }));
  }

  const lastTokenUpper = toUpper(tokens[tokens.length - 1]);

  const isKnownCh = suggestions.some((s) =>
    s.chList.some((ch) => toUpper(ch.code).startsWith(lastTokenUpper))
  );

  if (!isKnownCh) {
    return suggestions.map((s) => ({
      ...s,
      chList: s.chList.map((ch) => ({ ...ch, isCandidate: true, isBestSuggestion: false })),
    }));
  }

  const marked = suggestions.map((s) => ({
    ...s,
    chList: s.chList.map((ch) => {
      const isCandidate = toUpper(ch.code).startsWith(lastTokenUpper);
      return { ...ch, isCandidate, isBestSuggestion: false };
    }),
  }));

  // bestSuggestion only if there is exactly 1 candidate overall
  let first: { sIndex: number; chIndex: number } | null = null;
  let count = 0;

  marked.forEach((s, sIndex) => {
    s.chList.forEach((ch, chIndex) => {
      if (ch.isCandidate) {
        count += 1;
        if (count === 1) first = { sIndex, chIndex };
      }
    });
  });

  if (count !== 1 || !first) return marked;

  return marked.map((s, sIndex) => ({
    ...s,
    chList: s.chList.map((ch, chIndex) => ({
      ...ch,
      isBestSuggestion: sIndex === first!.sIndex && chIndex === first!.chIndex,
    })),
  }));
};

export const useOperationalPointSearch = ({
  infraId,
  buildOpSuggestion,
  pageSize = 101,
  minChars = 2,
  debounceMs = 300,
}: Params) => {
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [draftByStepId, setDraftByStepId] = useState<Record<string, string>>({});
  const [displayByStepId, setDisplayByStepId] = useState<Record<string, string>>({});
  const [isEditingByStepId, setIsEditingByStepId] = useState<Record<string, boolean>>({});
  const activeDraft = activeStepId ? (draftByStepId[activeStepId] ?? '') : '';
  const isEditingActive = activeStepId ? (isEditingByStepId[activeStepId] ?? true) : true;
  const debouncedOpInput = useDebounce((isEditingActive ? activeDraft : '').trim(), debounceMs);

  const setInputForStep = useCallback((stepId: string, value: string) => {
    setIsEditingByStepId((prev) => ({ ...prev, [stepId]: true }));
    setDraftByStepId((prev) => ({ ...prev, [stepId]: value }));
  }, []);

  const getInputForStep = useCallback(
    (stepId: string) => {
      const isEditing = isEditingByStepId[stepId] ?? true;
      return isEditing ? (draftByStepId[stepId] ?? '') : (displayByStepId[stepId] ?? '');
    },
    [draftByStepId, displayByStepId, isEditingByStepId]
  );

  const [opSuggestions, setOpSuggestions] = useState<OperationalPointSuggestion[]>([]);

  const resetOpSuggestions = useCallback(() => setOpSuggestions([]), []);

  const commitSelectionForStep = useCallback((stepId: string, display: string) => {
    setDisplayByStepId((prev) => ({ ...prev, [stepId]: display }));
    setDraftByStepId((prev) => ({ ...prev, [stepId]: '' }));
    setIsEditingByStepId((prev) => ({ ...prev, [stepId]: false }));
    setOpSuggestions([]);
  }, []);

  const startEditingForStep = useCallback((stepId: string) => {
    setIsEditingByStepId((prev) => ({ ...prev, [stepId]: true }));
  }, []);

  const chooseChForSuggestion = useCallback(
    (stepId: string, suggestion: OperationalPointSuggestion, forcedCh?: string) => {
      const rawInput = draftByStepId[stepId] ?? '';
      const unique = inferUniqueChFromInput(suggestion, rawInput);
      return forcedCh ?? unique ?? suggestion.chList[0]?.code;
    },
    [draftByStepId]
  );

  const formatChosenValue = useCallback(
    (s: OperationalPointSuggestion, ch: string) => `${s.name} ${ch}`,
    []
  );

  useEffect(() => {
    if (!activeStepId) return;

    if (!debouncedOpInput || debouncedOpInput.length < minChars) {
      resetOpSuggestions();
      return;
    }

    let cancelled = false;

    const tokens = splitTokens(debouncedOpInput);
    const firstTokenUpper = toUpper(tokens[0] ?? '');

    const searchQuery = [
      'or',
      ['search', ['name'], debouncedOpInput],
      ['search', ['trigram'], debouncedOpInput],
      ['search', ['ch'], debouncedOpInput],
    ];

    const largePayload = {
      object: 'operationalpoint',
      query: ['and', searchQuery, infraId !== undefined ? ['=', ['infra_id'], infraId] : true],
    };

    const exactTrigramPayload = {
      object: 'operationalpoint',
      query: [
        'and',
        ['=', ['trigram'], firstTokenUpper],
        infraId !== undefined ? ['=', ['infra_id'], infraId] : true,
      ],
    };

    const multiPayloadFromTokens = (toks: string[]) => {
      const multiQuery = buildMultiTokenQuery(toks);
      return {
        object: 'operationalpoint',
        query: ['and', multiQuery, infraId !== undefined ? ['=', ['infra_id'], infraId] : true],
      };
    };

    const apply = (sugs: OperationalPointSuggestion[]) => {
      const ranked = sortSuggestions(sugs, debouncedOpInput);
      const marked = markSuggestions(ranked, debouncedOpInput);
      setOpSuggestions(marked);
    };

    // 1) Large call on the entire query
    postSearch({ searchPayload: largePayload, pageSize })
      .unwrap()
      .then((results) => {
        if (cancelled) return;

        const res = results as SearchResultItemOperationalPoint[];
        const suggestionsLarge = buildOpSuggestion(res);

        // 2) We try to lock trigram from the "large" call
        const trigramExactFromLarge = firstTokenUpper
          ? suggestionsLarge.filter((s) => toUpper(s.trigram) === firstTokenUpper)
          : [];
        // If we have an exact trigram and the rest is coherent (name startsWith / CH ok), we proceed with this suggestion (no other calls)
        const keptFromLarge = trigramExactFromLarge.filter((s) => shouldKeepTrigramLock(s, tokens));
        if (keptFromLarge.length > 0) {
          apply(suggestionsLarge);
        }

        // 3) Fallback: exact trigram via a dedicated call (when the large one doesn't return it)
        // We "lock" only if the rest is coherent, otherwise we relaunch a normal call.
        postSearch({ searchPayload: exactTrigramPayload, pageSize })
          .unwrap()
          .then((exactRes) => {
            if (cancelled) return;

            const exact = exactRes as SearchResultItemOperationalPoint[];
            if (exact.length > 0) {
              const suggestionsExact = buildOpSuggestion(exact);
              const keptExact = suggestionsExact.filter((s) => shouldKeepTrigramLock(s, tokens));
              if (keptExact.length > 0) {
                apply(uniqById([...keptExact, ...suggestionsExact, ...suggestionsLarge]));
                return;
              }
            }

            if (tokens.length > 1) {
              const multiPayload = multiPayloadFromTokens(tokens);

              postSearch({ searchPayload: multiPayload, pageSize })
                .unwrap()
                .then((multiRes) => {
                  if (cancelled) return;

                  const multi = multiRes as SearchResultItemOperationalPoint[];
                  const multiSuggestions = buildOpSuggestion(multi);

                  apply(uniqById([...suggestionsLarge, ...multiSuggestions]));
                });

              return;
            }

            apply(suggestionsLarge);
          });
      })
      .catch(() => {
        if (!cancelled) resetOpSuggestions();
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStepId,
    debouncedOpInput,
    infraId,
    postSearch,
    buildOpSuggestion,
    pageSize,
    minChars,
    resetOpSuggestions,
  ]);

  return {
    activeStepId,
    setActiveStepId,
    getInputForStep,
    setInputForStep,
    opSuggestions,
    resetOpSuggestions,
    chooseChForSuggestion,
    formatChosenValue,
    commitSelectionForStep,
    startEditingForStep,
  };
};
