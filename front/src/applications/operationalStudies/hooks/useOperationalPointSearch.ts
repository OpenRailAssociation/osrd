import { useCallback, useEffect, useState } from 'react';

import { osrdEditoastApi, type SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import { useDebounce } from 'utils/helpers';
import { splitTokens, toUpper } from 'utils/strings';

import { sortSuggestions, markSuggestions, uniqById } from '../helpers/rankingSuggestions';
import {
  largePayload,
  exactTrigramPayload,
  multiPayloadFromTokens,
} from '../helpers/searchPayload';
import { selectSecondaryCode, shouldKeepTrigramLock } from '../helpers/suggestionMatchers';
import type { OperationalPointSuggestion } from '../views/Scenario/components/ManageTimetableItem/Itinerary/ComboBoxCustomList/ListElementComponent';

type Params = {
  infraId?: number;
  buildOpSuggestion: (res: SearchResultItemOperationalPoint[]) => OperationalPointSuggestion[];
  pageSize?: number;
  minChars?: number;
  debounceMs?: number;
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
  const rawActiveInput = isEditingActive ? activeDraft : '';
  const debouncedRawInput = useDebounce(rawActiveInput, debounceMs);
  const debouncedTrimmedInput = debouncedRawInput.trim();
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
      return selectSecondaryCode(suggestion, rawInput, forcedCh);
    },
    [draftByStepId]
  );

  const formatChosenValue = useCallback(
    (s: OperationalPointSuggestion, secondaryCode: string) => `${s.name} ${secondaryCode}`,
    []
  );

  useEffect(() => {
    if (!activeStepId) return;

    if (!debouncedTrimmedInput || debouncedTrimmedInput.length < minChars) {
      resetOpSuggestions();
      return;
    }

    let cancelled = false;

    const tokens = splitTokens(debouncedTrimmedInput);
    const firstTokenUpper = toUpper(tokens[0] ?? '');

    const apply = (sugs: OperationalPointSuggestion[]) => {
      const ranked = sortSuggestions(sugs, debouncedRawInput);
      const marked = markSuggestions(ranked, debouncedRawInput);
      setOpSuggestions(marked);
    };

    const searchOps = async () => {
      try {
        // 1) Large call on the entire query
        const largeRes = (await postSearch({
          searchPayload: largePayload(infraId, debouncedTrimmedInput),
          pageSize,
        }).unwrap()) as SearchResultItemOperationalPoint[];

        if (cancelled) return;

        const suggestionsLarge = buildOpSuggestion(largeRes);

        // 2) We try to lock trigram from the "large" call
        if (firstTokenUpper) {
          const trigramExactFromLarge = suggestionsLarge.filter(
            (s) => toUpper(s.trigram) === firstTokenUpper
          );
          // If we have an exact trigram and the rest is coherent (name startsWith / secondary code ok), we proceed with this suggestion (no other calls)
          const keptFromLarge = trigramExactFromLarge.filter((s) =>
            shouldKeepTrigramLock(s, tokens)
          );

          if (keptFromLarge.length > 0) {
            apply(suggestionsLarge);
            return;
          }
        }

        // 3) Fallback: exact trigram via a dedicated call (when the large one doesn't return it)
        // We "lock" only if the rest is coherent, otherwise we relaunch a normal call.
        if (firstTokenUpper) {
          const exactRes = (await postSearch({
            searchPayload: exactTrigramPayload(infraId, firstTokenUpper),
            pageSize,
          }).unwrap()) as SearchResultItemOperationalPoint[];

          if (cancelled) return;

          if (exactRes.length > 0) {
            const suggestionsExact = buildOpSuggestion(exactRes);
            const keptExact = suggestionsExact.filter((s) => shouldKeepTrigramLock(s, tokens));

            if (keptExact.length > 0) {
              apply(uniqById([...keptExact, ...suggestionsExact, ...suggestionsLarge]));
              return;
            }
          }
        }

        if (tokens.length > 1) {
          const multiRes = (await postSearch({
            searchPayload: multiPayloadFromTokens(infraId, tokens),
            pageSize,
          }).unwrap()) as SearchResultItemOperationalPoint[];

          if (cancelled) return;

          const multiSuggestions = buildOpSuggestion(multiRes);
          apply(uniqById([...suggestionsLarge, ...multiSuggestions]));
          return;
        }

        apply(suggestionsLarge);
      } catch {
        if (!cancelled) resetOpSuggestions();
      }
    };

    searchOps();

    return () => {
      cancelled = true;
    };
  }, [
    activeStepId,
    debouncedRawInput,
    debouncedTrimmedInput,
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
    formatChosenValue,
    commitSelectionForStep,
    startEditingForStep,
    chooseChForSuggestion,
  };
};
